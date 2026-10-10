/* MRC voluntary donations — configure Stripe Payment Links here.
 * Fixed amounts: create three fixed-price Payment Links in Stripe.
 * Other: existing customer-chosen amount Payment Link.
 * Never append undocumented amount parameters to Stripe URLs.
 */
(() => {
  "use strict";
  const STRIPE_LINKS = {
    "1": "https://buy.stripe.com/14AbJ0evvfwyeIrh2X4sE03", // Paste the Stripe Payment Link for 1 EUR
    "3": "https://buy.stripe.com/3cI00i9bb5VY1VFaEz4sE05", // Paste the Stripe Payment Link for 3 EUR
    "5": "https://buy.stripe.com/14AaEW9bb3NQ1VFh2X4sE06", // Paste the Stripe Payment Link for 5 EUR
    other: "https://buy.stripe.com/eVq5kCaff0BE1VFdQL4sE02" // Editable amount
  };
  const valid = (raw) => {
    try { const u = new URL(raw); return u.protocol === "https:" && (u.hostname === "buy.stripe.com" || u.hostname.endsWith(".stripe.com")) ? u.href : ""; }
    catch { return ""; }
  };
  document.querySelectorAll("[data-support-link]").forEach((a) => {
    const url = valid(STRIPE_LINKS.other);
    if (url) { a.href = url; a.hidden = false; }
  });
  document.querySelectorAll("[data-support-pending]").forEach((el) => {
    if (valid(STRIPE_LINKS.other)) el.hidden = true;
  });
  const it = document.documentElement.lang.toLowerCase().startsWith("it") || location.pathname.startsWith("/it/");
  // Only tools that actually produce a file or processed text; request pages excluded.
  const outputTools = new Set([
    "pdf-compressor", "webp-compressor", "image-to-target-size", "foto-entro-peso",
    "white-to-transparent", "bianco-trasparente", "images-to-pdf", "immagini-in-pdf",
    "print-pdf-to-web", "da-pdf-stampa-a-web", "clean-wp-clipboard", "multiple-find-replace"
  ]);
  const slug = location.pathname.split("/").filter(Boolean).at(-1);
  // Snippet pages produce a usable result when the visitor copies code.
  // Exclude request-only pages (which have no copyable snippet).
  const isSnippet = !!document.querySelector('[data-copy]');
  if (!outputTools.has(slug) && !isSnippet) return;
  // Use a single block. It starts before feedback and moves to the successful result.
  const section = document.createElement("section");
  section.className = "mrc-donation";
  section.setAttribute("aria-label", it ? "Donazione volontaria" : "Voluntary donation");
  section.innerHTML = `<h2>${it ? "Ti è stato utile?" : "Found this useful?"}</h2>
    <p>${it ? "I Tools MRC sono gratuiti e disponibili per tutti. Se questo strumento ti ha aiutato, puoi sostenere lo sviluppo dei prossimi con una donazione libera." : "MRC Tools are free and available to everyone. If this tool helped you, you can support future development with a voluntary donation."}</p>
    <p class="mrc-donation-caption">${it ? "Scegli un importo oppure personalizzalo. Anche 1 € è benvenuto." : "Choose an amount or set your own. Even €1 helps."}</p>
    <div class="mrc-donation-options"></div>
    <p class="mrc-donation-footnote">${it ? "Donazione facoltativa. Nessuna funzionalità a pagamento." : "Optional donation. No paid features."}</p>`;
  const options = section.querySelector(".mrc-donation-options");
  for (const [key, label] of [["1","1 €"],["3","3 €"],["5","5 €"],["other",it ? "Altro importo" : "Other amount"]]) {
    const url = valid(STRIPE_LINKS[key]);
    const a = document.createElement("a");
    a.className = "mrc-donation-choice";
    a.textContent = label;
    if (url) { a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer"; }
    else { a.classList.add("is-unconfigured"); a.setAttribute("aria-disabled", "true"); }
    options.appendChild(a);
  }
  const style = document.createElement("style");
  style.textContent = `
    .mrc-donation{box-sizing:border-box;margin:24px 0 24px max(0px, calc((100% - 920px)/2));padding:20px;border:1px solid currentColor;border-radius:12px;width:100%;max-width:620px}
    .mrc-donation h2{margin:0 0 10px;font-size:1.1rem}.mrc-donation p{margin:8px 0 12px}
    .mrc-donation-caption{font-weight:600}.mrc-donation-options{display:flex;flex-wrap:wrap;gap:9px;margin:14px 0}
    .mrc-donation-choice{display:inline-flex;align-items:center;justify-content:center;min-height:42px;min-width:65px;padding:8px 15px;border:1px solid currentColor;border-radius:8px;text-decoration:none;color:inherit;font-weight:650}
    .mrc-donation-choice:hover:not(.is-unconfigured){background:rgba(128,128,128,.12)}
    .mrc-donation-choice.is-unconfigured{opacity:.4;pointer-events:none}
    .mrc-donation-footnote{font-size:.82rem;opacity:.72}
    /* Keep the same typography and text colors; reduce emphasis by spacing only. */
    .mrc-tool-afterword .mrc-tool-specific{padding-top:18px!important;padding-bottom:14px!important;margin-top:8px!important}
    .mrc-tool-afterword .mrc-tool-specific h2{font-size:1.05rem!important;margin-bottom:8px!important}
    .mrc-tool-afterword .mrc-tool-specific p{margin:0 0 9px!important}
  `;
  document.head.appendChild(style);
  const feedback = document.querySelector(".mrc-tool-feedback");
  const fallback = document.querySelector(".mrc-related") || document.querySelector("main");
  if (feedback) feedback.before(section);
  else if (fallback) fallback.after(section);
  else document.body.appendChild(section);

  const result = document.getElementById("resultSection") ||
    document.getElementById("result-section") ||
    (slug !== "multiple-find-replace" ? document.getElementById("result") : null);
  const visible = (el) => !!el && !el.hidden && getComputedStyle(el).display !== "none" && getComputedStyle(el).visibility !== "hidden";
  const moveAfterResult = () => {
    if (visible(result) && section.previousElementSibling !== result) result.after(section);
  };
  if (result) {
    new MutationObserver(moveAfterResult).observe(result, {attributes:true,attributeFilter:["hidden","style","class"]});
    moveAfterResult();
  }
  // Some tools use a canvas or text output without a hidden result container.
  // Only reposition on an explicit completed download/copy action.
  document.addEventListener("click", (ev) => {
    const target = ev.target instanceof Element ? ev.target.closest("button,a") : null;
    if (!target || target.disabled || target.getAttribute("aria-disabled") === "true") return;
    if (target.closest(".mrc-donation")) return;
    const hint = `${target.id} ${target.className} ${target.textContent}`.toLowerCase();
    const isCopySnippet = !!target.matches('[data-copy]');
    if (!isCopySnippet && !/(download|scarica|esporta|export|copy|copia|save|salva)/.test(hint)) return;
    // Do not move away from a visible result container.
    if (visible(result)) { moveAfterResult(); return; }
    const host = isCopySnippet
      ? (target.closest('.mrc-snippet,.codebox,.section') || target.parentElement)
      : (target.closest(".result,.results,.output,.panel,section") || target.parentElement);
    if (host && host !== section && host.nextElementSibling !== section) host.after(section);
  });
})();
