use crate::models::{EventRow, Gift, Registration};
use crate::services::util::send_email;
use crate::services::ApiError;

fn shell(title: &str, body: &str) -> String {
    format!(
        "<div style=\"font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937\">\
         <h2 style=\"color:#0f766e\">{title}</h2>{body}\
         <p style=\"margin-top:32px;font-size:12px;color:#6b7280\">EventManager · Este mensaje se ha generado automáticamente.</p></div>"
    )
}

pub async fn registration_confirmed(
    registration: &Registration,
    event: &EventRow,
    modality_name: &str,
) -> Result<(), ApiError> {
    let body = format!(
        "<p>Hola <strong>{}</strong>,</p>\
         <p>Tu inscripción a <strong>{}</strong> está confirmada.</p>\
         <ul><li>Modalidad: {}</li><li>Localizador: <strong>{}</strong></li><li>Importe: {:.2} €</li></ul>\
         <p>Guarda tu localizador para consultar o modificar la inscripción.</p>",
        registration.first_name,
        event.name,
        modality_name,
        registration.locator,
        registration.total
    );
    send_email(
        &registration.email,
        &format!("Inscripción confirmada · {}", event.name),
        &shell("Inscripción confirmada", &body),
    )
    .await
}

pub async fn gift_purchased(gift: &Gift, event: &EventRow, modality_name: &str) -> Result<(), ApiError> {
    let body = format!(
        "<p>Hola <strong>{}</strong>,</p>\
         <p>Has recibido una inscripción de regalo para <strong>{}</strong> ({}).</p>\
         <p>Canjea tu regalo con este código:</p>\
         <p style=\"font-size:24px;letter-spacing:4px;font-weight:bold\">{}</p>\
         <p>{}</p>",
        gift.recipient_name, event.name, modality_name, gift.code, gift.message
    );
    send_email(
        &gift.recipient_email,
        &format!("Tienes un regalo para {} · {}", event.name, gift.code),
        &shell("Un regalo para ti", &body),
    )
    .await?;
    if gift.buyer_email != gift.recipient_email {
        let buyer_body = format!(
            "<p>Hola <strong>{}</strong>,</p>\
             <p>Tu regalo para <strong>{}</strong> ya está disponible.</p>\
             <p>Código de canje: <strong>{}</strong></p>",
            gift.buyer_name, gift.recipient_name, gift.code
        );
        send_email(
            &gift.buyer_email,
            &format!("Regalo confirmado · {}", event.name),
            &shell("Regalo confirmado", &buyer_body),
        )
        .await?;
    }
    Ok(())
}

pub async fn gift_claimed(gift: &Gift, registration: &Registration, event: &EventRow) -> Result<(), ApiError> {
    let body = format!(
        "<p>Hola <strong>{}</strong>,</p>\
         <p>El regalo para <strong>{}</strong> se ha canjeado correctamente.</p>\
         <p>Localizador de la inscripción: <strong>{}</strong></p>",
        gift.buyer_name, gift.recipient_name, registration.locator
    );
    send_email(
        &gift.buyer_email,
        &format!("Regalo canjeado · {}", event.name),
        &shell("Regalo canjeado", &body),
    )
    .await
}

pub async fn recovery(registration: &Registration, event: &EventRow) -> Result<(), ApiError> {
    let body = format!(
        "<p>Hola <strong>{}</strong>,</p>\
         <p>Has solicitado recuperar los datos de tu inscripción a <strong>{}</strong>.</p>\
         <p>Localizador: <strong>{}</strong></p>\
         <p>Estado: {}</p>",
        registration.first_name, event.name, registration.locator, registration.status
    );
    send_email(
        &registration.email,
        &format!("Recuperar inscripción · {}", event.name),
        &shell("Recuperar inscripción", &body),
    )
    .await
}
