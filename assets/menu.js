(() => {
    "use strict";

    const button = document.querySelector("[data-popup-menu-toggle]");
    const popup = document.getElementById("site-popup-menu");
    const site = document.querySelector(".site");
    const topbar = document.querySelector(".topbar");

    if (!button || !popup || !site || !topbar) {
        return;
    }

    const openLabel = button.dataset.openLabel || "Menu";
    const closeLabel = button.dataset.closeLabel || "Close";
    const label = button.querySelector('[data-menu-label]');
    const icon = button.querySelector('.menu-icon');
    const initialAriaLabel = button.getAttribute('aria-label') || openLabel;

    const positionPopup = () => {
        const siteRect = site.getBoundingClientRect();
        const topbarRect = topbar.getBoundingClientRect();

        popup.style.left = `${siteRect.left}px`;
        popup.style.width = `${siteRect.width}px`;
        popup.style.top = `${topbarRect.bottom}px`;
        popup.style.maxHeight = `${Math.max(0, window.innerHeight - topbarRect.bottom)}px`;
    };

    const setState = (open, restoreFocus = false) => {
        positionPopup();

        popup.classList.toggle("is-open", open);
        popup.setAttribute("aria-hidden", String(!open));
        button.setAttribute("aria-expanded", String(open));
        (label || button).textContent = open ? closeLabel : openLabel;
        if (icon) icon.textContent = open ? '×' : '☰';
        button.setAttribute("aria-label", open ? closeLabel : initialAriaLabel);

        if (open) {
            popup.removeAttribute("inert");
        } else {
            popup.setAttribute("inert", "");

            if (restoreFocus) {
                button.focus();
            }
        }
    };

    button.addEventListener("click", () => {
        setState(!popup.classList.contains("is-open"));
    });

    document.addEventListener("keydown", (event) => {
        if (
            event.key === "Escape" &&
            popup.classList.contains("is-open")
        ) {
            setState(false, true);
        }
    });

    document.addEventListener("click", (event) => {
        if (
            popup.classList.contains("is-open") &&
            !popup.contains(event.target) &&
            !button.contains(event.target)
        ) {
            setState(false);
        }
    });

    popup.addEventListener("click", (event) => {
        if (event.target.closest("a")) {
            setState(false);
        }
    });

    window.addEventListener("resize", positionPopup);
    window.addEventListener("scroll", positionPopup, { passive: true });

    positionPopup();
    setState(false);
})();
