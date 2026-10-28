output "site_url" {
  value = "https://${aws_cloudfront_distribution.site.domain_name}"
}

output "lambda_function_name" {
  value = aws_lambda_function.api.function_name
}
