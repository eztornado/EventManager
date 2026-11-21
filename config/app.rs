use larust_support::serde_json::{json, Value};

pub fn config() -> Value {
    let mut config = json!({});

    config["app_name"] = json!(larust_support::config_env::env_or("APP_NAME", "eventmanager"));

    config["app_env"] = json!(larust_support::config_env::env_or("APP_ENV", "local"));

    // Platforms such as Coolify inject PORT; local development keeps using
    // APP_PORT (or the port embedded in APP_URL).
    let platform_port = larust_support::config_env::env_or("PORT", "");
    let app_port = if platform_port.is_empty() {
        larust_support::config_env::app_port_or(34187)
    } else {
        platform_port.parse::<u16>().unwrap_or(34187)
    };
    config["app_port"] = json!(app_port);

    config["app_host"] = json!(larust_support::config_env::env_or(
        "APP_HOST",
        "127.0.0.1"
    ));

    config["session_secure_cookie"] = json!(larust_support::config_env::env_bool("SESSION_SECURE_COOKIE", true));

    config["app_debug"] = json!(larust_support::config_env::env_bool("APP_DEBUG", true));

    config["app_url"] = json!(larust_support::config_env::env_or("APP_URL", "http://localhost"));

    config["frontend_url"] = json!(larust_support::config_env::env_or(
        "FRONTEND_URL",
        "http://localhost:8099"
    ));

    config["payment_provider"] = json!(larust_support::config_env::env_or(
        "PAYMENT_PROVIDER",
        "demo"
    )
    .to_lowercase());

    config["stripe_secret_key"] = json!(larust_support::config_env::env_or("STRIPE_SECRET_KEY", ""));

    config["stripe_api_base"] = json!(
        larust_support::config_env::env_or("STRIPE_API_BASE", "https://api.stripe.com/v1")
            .trim_end_matches('/')
            .to_string()
    );

    config["stripe_webhook_secret"] = json!(larust_support::config_env::env_or(
        "STRIPE_WEBHOOK_SECRET",
        ""
    ));

    config["stripe_currency"] = json!(larust_support::config_env::env_or("STRIPE_CURRENCY", "eur")
        .to_lowercase());

    config["api_prefix"] = json!(larust_support::config_env::env_or("API_PREFIX", "/api"));

    config["app_locale"] = json!(larust_support::config_env::env_or("APP_LOCALE", "en"));

    config["app_fallback_locale"] = json!(larust_support::config_env::env_or("APP_FALLBACK_LOCALE", "en"));

    config["mail_driver"] = json!(larust_support::config_env::env_or("MAIL_DRIVER", "log"));

    config["mail_host"] = json!(larust_support::config_env::env_or("MAIL_HOST", "127.0.0.1"));

    config["mail_port"] = json!(larust_support::config_env::env_or("MAIL_PORT", "587").parse::<u16>().unwrap_or(587));

    config["mail_username"] = json!(larust_support::config_env::env_or("MAIL_USERNAME", ""));

    config["mail_password"] = json!(larust_support::config_env::env_or("MAIL_PASSWORD", ""));

    config["mail_encryption"] = json!(larust_support::config_env::env_or("MAIL_ENCRYPTION", "tls"));

    config["mail_from_address"] = json!(larust_support::config_env::env_or("MAIL_FROM_ADDRESS", "hello@example.com"));

    config["cache_driver"] = json!(larust_support::config_env::env_or("CACHE_DRIVER", "database"));

    config["queue_driver"] = json!(larust_support::config_env::env_or("QUEUE_DRIVER", "database"));

    config["log_channel"] = json!(larust_support::config_env::env_or("LOG_CHANNEL", "stdout"));

    config["log_level"] = json!(larust_support::config_env::env_or("LOG_LEVEL", ""));

    config["log_max_size"] = json!(larust_support::config_env::env_or("LOG_MAX_SIZE", "10485760").parse::<u64>().unwrap_or(10485760));

    config["log_keep_files"] = json!(larust_support::config_env::env_or("LOG_KEEP_FILES", "5").parse::<u32>().unwrap_or(5));

    config["deploy_type"] = json!(larust_support::config_env::env_or("DEPLOY_TYPE", "web"));

    config["session_driver"] = json!(larust_support::config_env::env_or("SESSION_DRIVER", "database"));

    let mail_from_name = larust_support::config_env::env("MAIL_FROM_NAME");
    config["mail_from_name"] = json!(if mail_from_name.is_empty() { config["app_name"].as_str().unwrap_or_default().to_string() } else { mail_from_name });

    config
}
