variable "project" {
  description = "リソース名の接頭辞"
  type        = string
  default     = "jev-demo"
}

variable "region" {
  type    = string
  default = "ap-northeast-1"
}

variable "aws_profile" {
  description = "使用する AWS CLI のプロファイル名"
  type        = string
  default     = "jev-demo"
}

variable "jev_model" {
  type    = string
  default = "jev-latest"
}

variable "jev_api_key_param" {
  description = "TypeSafe API キーを保存した Parameter Store（SecureString）の名前。Terraform では作成せず、事前に手動で登録する"
  type        = string
  default     = "/jev-demo/typesafe-api-key"
}

variable "bedrock_model_id" {
  description = "対決相手の Bedrock モデル ID（推論プロファイル ID）"
  type        = string
}

variable "basic_auth_user" {
  type      = string
  sensitive = true
}

variable "basic_auth_password" {
  type      = string
  sensitive = true
}
