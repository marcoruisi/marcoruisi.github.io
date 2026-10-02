/* Stripe Payment Link: replace the URL below with the next full HTTPS URL.
 * Leave empty until the link is ready. No Stripe API, credentials or SDK.
 */
(() => {
    "use strict";
    const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/eVq5kCaff0BE1VFdQL4sE02"; // Temporary: replace this URL only.
    if (!STRIPE_PAYMENT_LINK) return;
    let url;
    try { url = new URL(STRIPE_PAYMENT_LINK); } catch { return; }
    if (url.protocol !== "https:") return;
    document.querySelectorAll("[data-support-link]").forEach((link) => {
        link.href = url.href;
        link.hidden = false;
    });
    document.querySelectorAll("[data-support-pending]").forEach((note) => {
        note.hidden = true;
    });
})();
