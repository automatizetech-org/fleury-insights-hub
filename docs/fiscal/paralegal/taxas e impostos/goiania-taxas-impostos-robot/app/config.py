from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    supabase_url: str
    supabase_anon_key: str
    goiania_portal_cpf: str = "71361170115"
    goiania_portal_password: str = "12345678"
    robot_host: str = "0.0.0.0"
    robot_port: int = 8092
    playwright_user_data_dir: str = "./.playwright-profile"
    playwright_channel: str = "chrome"
    playwright_headless: bool = False
    robot_technical_id: str = "goiania_taxas_impostos"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
