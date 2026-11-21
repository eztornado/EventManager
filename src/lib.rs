#[path = "../config/mod.rs"]
pub mod config;
#[path = "../app/Http/Controllers/mod.rs"]
pub mod controllers;
#[path = "../app/Services/mod.rs"]
pub mod services;
#[path = "../app/Models/mod.rs"]
pub mod models;
#[path = "../database/seeders/mod.rs"]
pub mod seeders;
#[path = "../routes/mod.rs"]
pub mod routes;

/// This app's own root directory, independent of the process's current
/// working directory. `LARUST_APP_ROOT` overrides the compile-time default
/// so a binary can be moved to another machine and still resolve `.env`,
/// `storage/` and `database/` relative to wherever it actually runs.
pub fn paths() -> larust_core::AppPaths {
    larust_core::AppPaths::new(larust_core::resolve_app_root(env!("CARGO_MANIFEST_DIR")))
}

pub async fn connect_database() -> Result<(), larust_core::AppError> {
    larust_support::orm::connect(&database_url()?).await
}

fn database_url() -> Result<String, larust_core::AppError> {
    let url = config::database::config().default_connection_url()?;
    let relative_sqlite_path = url
        .strip_prefix("sqlite://")
        .filter(|path| !path.starts_with('/') && !path.starts_with(":memory:"))
        .map(str::to_string);

    Ok(match relative_sqlite_path {
        Some(relative) => {
            let path = paths().join(relative);
            format!("sqlite:///{}", path.to_string_lossy().replace('\\', "/"))
        }
        None => url,
    })
}

pub fn port() -> u16 {
    config::app::config()["app_port"]
        .as_u64()
        .and_then(|value| u16::try_from(value).ok())
        .unwrap_or(8080)
}

pub fn host() -> String {
    config::app::config()["app_host"]
        .as_str()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("127.0.0.1")
        .to_string()
}

pub fn application() -> Result<larust_core::Application, larust_core::AppError> {
    let app = larust_core::Application::at_root(
        larust_core::resolve_app_root(env!("CARGO_MANIFEST_DIR")),
        config::app::config,
    )?;
    Ok(app.with_error_pages(larust_core::ErrorPages {
        not_found: larust_support::error_view!("404"),
        internal: larust_support::error_view!("500"),
    }))
}

pub fn router(app: &larust_core::Application) -> larust_http::Router {
    routes::web::routes().merge(&app.config().api_prefix, routes::api::routes())
}

/// Connects the database, attaches sessions, serves the API, and falls back
/// to the built React application in `frontend/dist` when it exists.
pub async fn serve() -> Result<(), larust_core::AppError> {
    let app = application()?;
    let route = router(&app);

    connect_database().await?;
    let route = route
        .with_sessions(larust_support::orm::pool()?, app.config().session_secure_cookie)
        .await?;

    let axum_router = route.into_axum_router();
    let dist = paths().join("frontend/dist");
    let index = paths().join("frontend/dist/index.html");
    let axum_router = if dist.exists() {
        use larust_support::axum::response::Html;
        use larust_support::axum::routing::get;
        use tower_http::services::ServeDir;

        let index_body = std::fs::read_to_string(&index).unwrap_or_default();
        let spa_index = move || {
            let body = index_body.clone();
            async move { Html(body) }
        };
        axum_router.fallback_service(ServeDir::new(&dist).fallback(get(spa_index)))
    } else {
        axum_router
    };

    // `Application::serve()` installs its own `public/` fallback, so mount the
    // fully composed router ourselves to keep the SPA fallback in place.
    let address = host();
    let ip = address
        .parse::<std::net::IpAddr>()
        .unwrap_or(std::net::IpAddr::V4(std::net::Ipv4Addr::LOCALHOST));
    let addr = std::net::SocketAddr::new(ip, port());
    if app.config().app_env == "production"
        && std::env::var("JWT_SECRET")
            .map(|value| value.trim().len() < 32)
            .unwrap_or(true)
    {
        tracing::warn!(
            "JWT_SECRET is missing or too short; configure a random value of at least 32 characters in production"
        );
    }
    tracing::info!(%addr, app = %app.config().app_name, env = %app.config().app_env, "starting server");
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|source| larust_core::AppError::Internal(Box::new(source)))?;
    larust_support::axum::serve(listener, axum_router.into_make_service())
        .await
        .map_err(|source| larust_core::AppError::Internal(Box::new(source)))?;
    Ok(())
}
