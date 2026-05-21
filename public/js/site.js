/**
 * BrasilFLIX — navegação mobile, acessibilidade e SEO dinâmico (detalhes)
 */
(function () {
    "use strict";

    function initMobileNav() {
        document.querySelectorAll(".header-horizontal .navbar-toggler").forEach(function (btn) {
            if (btn.dataset.bfNavBound === "1") return;
            btn.dataset.bfNavBound = "1";
            btn.setAttribute("aria-expanded", "false");
            btn.setAttribute("aria-controls", "bf-main-nav");

            btn.addEventListener("click", function () {
                var header = btn.closest(".header-horizontal");
                if (!header) return;
                var open = header.classList.toggle("active");
                btn.setAttribute("aria-expanded", open ? "true" : "false");
                document.body.classList.toggle("bf-nav-open", open);
            });
        });

        var collapse = document.querySelector(".header-horizontal .navbar-collapse");
        if (collapse && !collapse.id) {
            collapse.id = "bf-main-nav";
        }

        document.querySelectorAll(".header-horizontal .navbar-nav .nav-link").forEach(function (link) {
            link.addEventListener("click", function () {
                closeMobileNav();
            });
        });

        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") closeMobileNav();
        });

        window.addEventListener("resize", function () {
            if (window.innerWidth >= 768) closeMobileNav();
        });
    }

    function closeMobileNav() {
        document.querySelectorAll(".header-horizontal.active").forEach(function (header) {
            header.classList.remove("active");
        });
        document.querySelectorAll(".navbar-toggler[aria-expanded='true']").forEach(function (btn) {
            btn.setAttribute("aria-expanded", "false");
        });
        document.body.classList.remove("bf-nav-open");
    }

    function markActiveNav() {
        var path = window.location.pathname.split("/").pop() || "homepage-1.html";
        document.querySelectorAll(".navbar-nav .nav-link").forEach(function (link) {
            var href = link.getAttribute("href") || "";
            var linkPath = href.split("/").pop();
            var active = linkPath === path ||
                (path === "homepage-1.html" && (linkPath === "homepage-1.html" || linkPath === "./homepage-1.html"));
            link.classList.toggle("active", active);
            if (active) link.setAttribute("aria-current", "page");
            else link.removeAttribute("aria-current");
        });
    }

    function wrapNavSemantic() {
        document.querySelectorAll(".header-horizontal .navbar").forEach(function (navbar) {
            if (navbar.dataset.bfNavSemantic === "1") return;
            navbar.dataset.bfNavSemantic = "1";
            if (navbar.getAttribute("role") !== "navigation") {
                navbar.setAttribute("role", "navigation");
            }
            if (!navbar.getAttribute("aria-label")) {
                navbar.setAttribute("aria-label", "Menu principal");
            }
        });
    }

    window.BFUpdatePageMeta = function (opts) {
        if (!opts || !opts.title) return;
        document.title = opts.title;
        var desc = document.querySelector('meta[name="description"]');
        if (desc && opts.description) desc.setAttribute("content", opts.description);
        var ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) ogTitle.setAttribute("content", opts.title);
        var ogDesc = document.querySelector('meta[property="og:description"]');
        if (ogDesc && opts.description) ogDesc.setAttribute("content", opts.description);
        var ogImg = document.querySelector('meta[property="og:image"]');
        if (ogImg && opts.image) ogImg.setAttribute("content", opts.image);
    };

    function init() {
        initMobileNav();
        markActiveNav();
        wrapNavSemantic();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
