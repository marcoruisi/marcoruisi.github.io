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
  const outputTools = new Set(["pdf-compressor", "webp-compressor", "image-to-target-size", "white-to-transparent", "images-to-pdf", "print-pdf-to-web", "clean-wp-clipboard", "multiple-find-replace"]);
  const slug = location.pathname.split("/").filter(Boolean).at(-1);
  if (!outputTools.has(slug)) return;
  const section = document.createElement("section");
  section.className = "mrc-donation";
  section.setAttribute("aria-label", it ? "Donazione volontaria" : "Voluntary donation");
  section.innerHTML = `<h2>${it ? "Ti è stato utile?" : "Found this useful?"}</h2>
    <p>${it ? "I Tools MRC sono gratuiti e disponibili per tutti. Se questo strumento ti ha aiutato, puoi sostenere lo sviluppo dei prossimi con una donazione libera." : "MRC Tools are free and available to everyone. If this tool helped you, you can support future development with a voluntary donation."}</p>
    <p class="mrc-donation-caption">${it ? "Scegli un importo oppure personalizzalo. Anche 1 € è benvenuto." : "Choose an amount or set your own. Even €1 helps."}</p>
    <div class="mrc-donation-options"></div>
    <p class="mrc-donation-footnote">${it ? "Donazione facoltativa. Il risultato resta gratuito." : "Optional donation. Your result remains free."}</p>`;
  const options = section.querySelector(".mrc-donation-options");
  for (const [key, label] of [["1","1 €"],["3","3 €"],["5","5 €"],["other",it ? "Altro importo" : "Other amount"]]) {
    const url = valid(STRIPE_LINKS[key]);
    const a = document.createElement("a");
    a.className = "mrc-donation-choice";
    a.textContent = label;
    if (url) { a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer"; }
    else { a.classList.add("is-unconfigured"); a.setAttribute("aria-disabled", "true"); a.title = it ? "Link Stripe da configurare in assets/support.js" : "Configure Stripe link in assets/support.js"; }
    options.appendChild(a);
  }
  const style = document.createElement("style");
  style.textContent = `.mrc-donation{margin:24px 0;padding:22px;border:1px solid currentColor;border-radius:12px;max-width:720px}.mrc-donation h2{margin:0 0 10px;font-size:1.15rem}.mrc-donation p{margin:8px 0 12px}.mrc-donation-caption{font-weight:600}.mrc-donation-options{display:flex;flex-wrap:wrap;gap:9px;margin:14px 0}.mrc-donation-choice{display:inline-flex;align-items:center;justify-content:center;min-height:42px;min-width:65px;padding:8px 15px;border:1px solid currentColor;border-radius:8px;text-decoration:none;color:inherit;font-weight:650}.mrc-donation-choice:hover:not(.is-unconfigured){background:rgba(128,128,128,.12)}.mrc-donation-choice.is-unconfigured{opacity:.4;cursor:not-allowed}.mrc-donation-footnote{font-size:.82rem;opacity:.72}`;
  document.head.appendChild(style);
  const result = document.getElementById("resultSection");
  const mount = () => {
    if (section.isConnected) return;
    if (result && !result.hidden && getComputedStyle(result).display !== "none") result.appendChild(section);
  };
  if (result) { new MutationObserver(mount).observe(result, {attributes:true,attributeFilter:["hidden","style","class"]}); mount(); }
  // For other output tools, show the invitation only after a successful download/copy action.
  if (!result) document.addEventListener("click", (ev) => {
    const target = ev.target.closest("button,a");
    if (!target || section.isConnected || target.disabled) return;
    const hint = `${target.id} ${target.className} ${target.textContent}`.toLowerCase();
    if (!/(download|scarica|esporta|export|copy|copia|save|salva)/.test(hint)) return;
    const host = target.closest(".result,.results,.output,.panel,section") || target.parentElement;
    if (host) host.appendChild(section);
  });
})();
