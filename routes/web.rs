use larust_http::Router;

/// The public site is a React single-page application served from
/// `frontend/dist` (see `src/lib.rs`'s `serve`). The framework's web router
/// is deliberately empty: server-rendered pages are not used by this app.
pub fn routes() -> Router {
    Router::new()
}
