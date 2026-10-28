data "archive_file" "api" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/src"
  output_path = "${path.module}/build/api.zip"
}

resource "aws_iam_role" "api" {
  name = "${local.name}-api"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "api_logs" {
  role       = aws_iam_role.api.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "api" {
  name = "${local.name}-api"
  role = aws_iam_role.api.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "ssm:GetParameter"
        Resource = "arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter${var.jev_api_key_param}"
      },
      {
        Effect    = "Allow"
        Action    = "kms:Decrypt"
        Resource  = "*"
        Condition = { StringEquals = { "kms:ViaService" = "ssm.${var.region}.amazonaws.com" } }
      },
      {
        # クロスリージョン推論プロファイルは、プロファイル本体と転送先リージョンの基盤モデルの両方に権限が要る
        Effect = "Allow"
        Action = "bedrock:InvokeModel"
        Resource = [
          "arn:aws:bedrock:*:${data.aws_caller_identity.current.account_id}:inference-profile/*",
          "arn:aws:bedrock:*::foundation-model/*",
        ]
      },
    ]
  })
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/${local.name}-api"
  retention_in_days = 14
}

resource "aws_lambda_function" "api" {
  function_name    = "${local.name}-api"
  role             = aws_iam_role.api.arn
  runtime          = "nodejs22.x"
  handler          = "index.handler"
  architectures    = ["arm64"]
  memory_size      = 1024
  timeout          = 30
  filename         = data.archive_file.api.output_path
  source_code_hash = data.archive_file.api.output_base64sha256

  environment {
    variables = {
      JEV_MODEL         = var.jev_model
      JEV_API_KEY_PARAM = var.jev_api_key_param
      BEDROCK_MODEL_ID  = var.bedrock_model_id
      ORIGIN_SECRET     = random_password.origin_secret.result
    }
  }

  depends_on = [aws_cloudwatch_log_group.api]
}

resource "aws_apigatewayv2_api" "api" {
  name          = "${local.name}-api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "api" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "api" {
  for_each  = toset(["POST /api/check", "POST /api/race/jev", "POST /api/race/llm", "POST /api/warmup"])
  api_id    = aws_apigatewayv2_api.api.id
  route_key = each.value
  target    = "integrations/${aws_apigatewayv2_integration.api.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit = 20
    throttling_rate_limit  = 10
  }
}

resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowApiGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}
