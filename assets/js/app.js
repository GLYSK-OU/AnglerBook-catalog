/* AnglerBook — Gear Archive
 * Vanilla JS single-page app. Loads catalog/gear.json, renders a browsable,
 * filterable archive, and provides a manufacturer catalog-submission flow.
 */
(function () {
  "use strict";

  var CATALOG_URL = "catalog/gear.json";
  var SUBMIT_EMAIL = "catalog@glysk.eu"; // AnglerBook catalog team inbox

  // ---- App state --------------------------------------------------------
  var data = null;           // raw catalog json
  var entries = [];          // flattened [{kind, kindLabel, specFields, brand, model}]
  var kindIndex = {};        // kind -> kind object
  var filters = { kind: "", brand: "", q: "", lineWeight: "" };

  // ---- DOM helpers ------------------------------------------------------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "class") node.className = attrs[k];
      else if (k === "text") node.textContent = attrs[k];
      else if (k === "html") node.innerHTML = attrs[k];
      else if (k in node && k !== "list") node[k] = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      if (c == null) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }
  function titleCase(s) {
    return String(s).replace(/(^|[\s-])\w/g, function (m) { return m.toUpperCase(); });
  }
  function fmtSpecKey(k) {
    return titleCase(String(k).replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim());
  }
  function fmtSpecVal(v) {
    if (typeof v === "boolean") return v ? "Yes" : "No";
    return String(v);
  }

  // ---- Load -------------------------------------------------------------
  function load() {
    fetch(CATALOG_URL, { cache: "no-cache" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(init)
      .catch(function (err) {
        var status = $("#status");
        status.className = "status error";
        status.textContent = "Could not load the catalog (" + err.message + "). " +
          "If you opened this file directly, serve the folder over HTTP (e.g. `python3 -m http.server`).";
      });
  }

  function init(json) {
    data = json;

    // flatten
    (data.kinds || []).forEach(function (k) {
      kindIndex[k.kind] = k;
      (k.brands || []).forEach(function (b) {
        (b.models || []).forEach(function (m) {
          entries.push({
            kind: k.kind,
            kindLabel: k.label || titleCase(k.kind),
            specFields: k.variantSpecFields || [],
            brand: b.brand,
            model: m
          });
        });
      });
    });

    renderHero();
    buildFilters();
    bindFilters();
    buildReference();
    buildSubmitForm();
    render();
  }

  // ---- Hero / stats -----------------------------------------------------
  function renderHero() {
    var c = data.counts || {};
    setStat("kinds", c.kinds);
    setStat("brands", c.brands);
    setStat("models", c.models);
    setStat("variants", c.variants);

    var meta = [];
    if (data.catalogVersion) meta.push("Catalog " + data.catalogVersion);
    if (data.schemaVersion) meta.push("schema v" + data.schemaVersion);
    if (data.generatedAt) meta.push("generated " + data.generatedAt.slice(0, 10));
    $("#hero-meta").textContent = meta.join(" · ");

    $("#footer-copy").textContent = data.copyright || "© GLYSK OÜ";
    if (data.disclaimer) $("#footer-disclaimer").textContent = data.disclaimer;
  }
  function setStat(name, val) {
    var node = $('[data-stat="' + name + '"]');
    if (node) node.textContent = (val != null ? val : "—");
  }

  // ---- Filters ----------------------------------------------------------
  function buildFilters() {
    var chips = $("#kind-chips");
    chips.appendChild(makeChip("", "All"));
    (data.kinds || []).forEach(function (k) {
      var n = (k.brands || []).reduce(function (a, b) { return a + (b.models || []).length; }, 0);
      chips.appendChild(makeChip(k.kind, (k.label || titleCase(k.kind)) + " (" + n + ")"));
    });
    updateChipState();

    // line weight options (1..12 from reference)
    var lw = $("#lineweight-select");
    var weights = (data.reference && data.reference.lineWeightSystem) || [];
    weights.forEach(function (w) {
      lw.appendChild(el("option", { value: String(w.weight), text: w.weight + " wt — " + w.use }));
    });

    refreshBrandOptions();
  }

  function makeChip(value, label) {
    var b = el("button", { type: "button", class: "chip", text: label });
    b.setAttribute("data-kind", value);
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", function () {
      filters.kind = value;
      filters.brand = "";       // reset brand when category changes
      $("#brand-select").value = "";
      updateChipState();
      refreshBrandOptions();
      toggleLineWeightField();
      render();
    });
    return b;
  }
  function updateChipState() {
    $all("#kind-chips .chip").forEach(function (c) {
      c.setAttribute("aria-pressed", c.getAttribute("data-kind") === filters.kind ? "true" : "false");
    });
    toggleLineWeightField();
  }
  function toggleLineWeightField() {
    var k = kindIndex[filters.kind];
    var show = k && (k.variantSpecFields || []).indexOf("lineWeight") !== -1;
    $("#lineweight-field").hidden = !show;
    if (!show) { filters.lineWeight = ""; $("#lineweight-select").value = ""; }
  }

  function refreshBrandOptions() {
    var sel = $("#brand-select");
    var current = filters.brand;
    var brands = {};
    entries.forEach(function (e) {
      if (!filters.kind || e.kind === filters.kind) brands[e.brand] = true;
    });
    var list = Object.keys(brands).sort();
    sel.innerHTML = "";
    sel.appendChild(el("option", { value: "", text: "All brands" }));
    list.forEach(function (b) { sel.appendChild(el("option", { value: b, text: b })); });
    sel.value = list.indexOf(current) !== -1 ? current : "";
    filters.brand = sel.value;
  }

  function bindFilters() {
    var search = $("#search");
    var t;
    search.addEventListener("input", function () {
      clearTimeout(t);
      t = setTimeout(function () { filters.q = search.value.trim().toLowerCase(); render(); }, 120);
    });
    $("#brand-select").addEventListener("change", function (e) { filters.brand = e.target.value; render(); });
    $("#lineweight-select").addEventListener("change", function (e) { filters.lineWeight = e.target.value; render(); });
    $("#reset-filters").addEventListener("click", function () {
      filters = { kind: "", brand: "", q: "", lineWeight: "" };
      search.value = "";
      $("#brand-select").value = "";
      $("#lineweight-select").value = "";
      updateChipState();
      refreshBrandOptions();
      render();
    });
  }

  // ---- Filtering & rendering --------------------------------------------
  function matches(e) {
    if (filters.kind && e.kind !== filters.kind) return false;
    if (filters.brand && e.brand !== filters.brand) return false;
    if (filters.lineWeight) {
      var lw = Number(filters.lineWeight);
      var has = (e.model.variants || []).some(function (v) {
        return v.specs && Number(v.specs.lineWeight) === lw;
      });
      if (!has) return false;
    }
    if (filters.q) {
      var hay = (e.brand + " " + e.model.model + " " + e.kindLabel + " " +
        (e.model.note || "") + " " + (e.model.series || "") + " " +
        (e.model.variants || []).map(function (v) { return v.code || ""; }).join(" ")).toLowerCase();
      if (hay.indexOf(filters.q) === -1) return false;
    }
    return true;
  }

  function render() {
    var grid = $("#grid");
    var status = $("#status");
    var list = entries.filter(matches);

    $("#result-count").textContent = list.length + " of " + entries.length + " product lines";

    grid.innerHTML = "";
    if (!list.length) {
      status.className = "status";
      status.textContent = "No gear matches these filters.";
      status.hidden = false;
      return;
    }
    status.hidden = true;

    list.sort(function (a, b) {
      return a.kindLabel.localeCompare(b.kindLabel) ||
        a.brand.localeCompare(b.brand) ||
        a.model.model.localeCompare(b.model.model);
    });

    var frag = document.createDocumentFragment();
    list.forEach(function (e) { frag.appendChild(card(e)); });
    grid.appendChild(frag);
  }

  function card(e) {
    var m = e.model;
    var attrs = ["series", "action", "material", "type", "waterType", "soleType", "imitates"];
    var tags = [];
    attrs.forEach(function (a) { if (m[a]) tags.push(m[a]); });

    var node = el("button", { type: "button", class: "card" }, [
      el("div", { class: "card-top" }, [
        el("span", { class: "card-kind", text: e.kindLabel }),
        el("span", { class: "card-count", text: (m.variants || []).length + " variant" + ((m.variants || []).length === 1 ? "" : "s") })
      ]),
      el("div", { class: "card-brand", text: e.brand }),
      el("h3", { class: "card-model", text: m.model }),
      tags.length ? el("div", { class: "card-tags" }, tags.slice(0, 4).map(function (t) {
        return el("span", { class: "tag", text: t });
      })) : null,
      m.note ? el("p", { class: "card-note", text: m.note }) : null
    ]);
    node.addEventListener("click", function () { openDetail(e); });
    return node;
  }

  // ---- Detail dialog ----------------------------------------------------
  function openDetail(e) {
    var m = e.model;
    var dlg = $("#detail-dialog");
    var box = $("#detail-content");
    var attrs = ["series", "action", "material", "type", "waterType", "imitates", "soleType", "footType", "use", "taper"];

    var head = el("div", { class: "detail-head" }, [
      el("span", { class: "detail-kind", text: e.kindLabel }),
      el("h2", { class: "detail-title", text: m.model }),
      el("div", { class: "detail-brand", text: e.brand })
    ]);

    var attrRow = el("div", { class: "detail-attrs" });
    attrs.forEach(function (a) { if (m[a]) attrRow.appendChild(el("span", { class: "tag", text: fmtSpecKey(a) + ": " + m[a] })); });

    // build variant table — columns from spec fields actually present
    var cols = [];
    (e.specFields || []).forEach(function (f) { cols.push(f); });
    (m.variants || []).forEach(function (v) {
      Object.keys(v.specs || {}).forEach(function (k) { if (cols.indexOf(k) === -1) cols.push(k); });
    });

    var thead = el("tr", {}, [el("th", { text: "Code" })].concat(cols.map(function (c) {
      return el("th", { text: fmtSpecKey(c) });
    })));
    var rows = (m.variants || []).map(function (v) {
      var cells = [el("td", { class: "code", text: v.code || v.label || "—" })];
      cols.forEach(function (c) {
        var val = v.specs && v.specs[c] != null ? fmtSpecVal(v.specs[c]) : "—";
        cells.push(el("td", { text: val }));
      });
      return el("tr", {}, cells);
    });
    var table = el("div", { class: "detail-table-wrap" }, [
      el("table", { class: "detail-table" }, [
        el("thead", {}, [thead]),
        el("tbody", {}, rows)
      ])
    ]);

    box.innerHTML = "";
    box.appendChild(el("button", { type: "button", class: "dialog-close", "aria-label": "Close", text: "×",
      onclick: function () { dlg.close(); } }));
    box.appendChild(head);
    if (attrRow.childNodes.length) box.appendChild(attrRow);
    if (m.note) box.appendChild(el("p", { class: "detail-note", text: m.note }));
    box.appendChild(table);

    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "");
  }

  // ---- Reference --------------------------------------------------------
  function buildReference() {
    var ref = data.reference;
    if (!ref) return;
    var grid = $("#reference-grid");

    if (ref.lineWeightSystem) {
      grid.appendChild(refCard("Line weight system", tableEl(
        ["Wt", "Typical use"],
        ref.lineWeightSystem.map(function (r) { return [r.weight, r.use]; })
      )));
    }
    if (ref.tippetSystem) {
      grid.appendChild(refCard("Tippet (X) system", tableEl(
        ["X", 'Ø in', "Ø mm", "Break lb"],
        ref.tippetSystem.map(function (r) { return [r.x, r.diameterIn, r.diameterMm, r.nominalBreakLb]; })
      )));
    }
    addPillCard(grid, "Rod actions", ref.rodActions);
    addPillCard(grid, "Line tapers", ref.lineTapers);
    addPillCard(grid, "Line densities", ref.lineDensities);

    if (ref.notes && ref.notes.length) {
      grid.appendChild(refCard("Notes", el("ul", { class: "ref-list" },
        ref.notes.map(function (n) { return el("li", { text: n }); }))));
    }
  }
  function refCard(title, body) {
    return el("div", { class: "ref-card" }, [el("h3", { text: title }), body]);
  }
  function tableEl(headers, rows) {
    return el("table", { class: "ref-table" }, [
      el("thead", {}, [el("tr", {}, headers.map(function (h) { return el("th", { text: h }); }))]),
      el("tbody", {}, rows.map(function (r) {
        return el("tr", {}, r.map(function (c) { return el("td", { text: c == null ? "—" : c }); }));
      }))
    ]);
  }
  function addPillCard(grid, title, arr) {
    if (!arr || !arr.length) return;
    grid.appendChild(refCard(title, el("div", { class: "ref-pills" },
      arr.map(function (a) { return el("span", { class: "ref-pill", text: a }); }))));
  }

  // ---- Submit catalog flow ---------------------------------------------
  function buildSubmitForm() {
    $("#submit-address").textContent = SUBMIT_EMAIL;

    var kindSel = $("#submit-kind");
    (data.kinds || []).forEach(function (k) {
      kindSel.appendChild(el("option", { value: k.kind, text: k.label || titleCase(k.kind) }));
    });

    var dlg = $("#submit-dialog");
    $("#open-submit").addEventListener("click", openSubmit);
    $all("[data-close-submit]").forEach(function (b) {
      b.addEventListener("click", function () { dlg.close(); });
    });
    dlg.addEventListener("click", function (e) {
      // click on backdrop closes
      if (e.target === dlg) dlg.close();
    });

    kindSel.addEventListener("change", rebuildVariants);
    $("#add-variant").addEventListener("click", function () { addVariantRow(); });
    $("#download-submission").addEventListener("click", function () { handleSubmit("download"); });
    $("#submit-form").addEventListener("submit", function (e) { e.preventDefault(); handleSubmit("email"); });
  }

  function openSubmit() {
    var dlg = $("#submit-dialog");
    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "");
  }

  function currentSpecFields() {
    var k = kindIndex[$("#submit-kind").value];
    return k ? (k.variantSpecFields || []) : [];
  }

  function rebuildVariants() {
    var fields = currentSpecFields();
    $("#spec-hint").textContent = fields.length ? "(spec fields: " + fields.join(", ") + ")" : "";
    $("#variants-list").innerHTML = "";
    addVariantRow();
  }

  function addVariantRow() {
    var tpl = $("#variant-row-template");
    var row = tpl.content.firstElementChild.cloneNode(true);
    var specWrap = $(".variant-specs", row);
    currentSpecFields().forEach(function (f) {
      var field = el("label", { class: "field field-sm" }, [
        el("span", { text: fmtSpecKey(f) }),
        el("input", { "data-sfield": f, placeholder: fmtSpecKey(f) })
      ]);
      specWrap.appendChild(field);
    });
    $(".variant-remove", row).addEventListener("click", function () {
      row.parentNode.removeChild(row);
    });
    $("#variants-list").appendChild(row);
  }

  function collectSubmission() {
    var form = $("#submit-form");
    var get = function (name) { return (form.elements[name].value || "").trim(); };

    var variants = $all("#variants-list .variant-row").map(function (row) {
      var code = ($('[data-vfield="code"]', row).value || "").trim();
      var specs = {};
      $all("[data-sfield]", row).forEach(function (inp) {
        var v = (inp.value || "").trim();
        if (v !== "") {
          var num = Number(v);
          specs[inp.getAttribute("data-sfield")] = (v !== "" && !isNaN(num) && /^-?\d*\.?\d+$/.test(v)) ? num : v;
        }
      });
      return { code: code, specs: specs };
    }).filter(function (v) { return v.code || Object.keys(v.specs).length; });

    return {
      contact: {
        brand: get("brand"),
        name: get("contactName"),
        email: get("contactEmail"),
        website: get("website")
      },
      submission: {
        app: "AnglerBook",
        type: "catalog-submission",
        submittedAt: new Date().toISOString(),
        kind: get("kind"),
        brand: get("brand"),
        model: {
          model: get("model"),
          note: get("note") || undefined,
          variants: variants
        }
      }
    };
  }

  function validate(payload) {
    var c = payload.contact, s = payload.submission;
    if (!c.brand) return "Please enter your company / brand.";
    if (!c.name) return "Please enter a contact name.";
    if (!c.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) return "Please enter a valid email address.";
    if (!s.kind) return "Please choose a category.";
    if (!s.model.model) return "Please enter a model name.";
    if (!s.model.variants.length) return "Please add at least one variant (with a code or specs).";
    return null;
  }

  function handleSubmit(mode) {
    var errBox = $("#form-error");
    var payload = collectSubmission();
    var err = validate(payload);
    if (err) {
      errBox.hidden = false;
      errBox.textContent = err;
      return;
    }
    errBox.hidden = true;

    var json = JSON.stringify(payload, null, 2);

    if (mode === "download") {
      var blob = new Blob([json], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = el("a", { href: url, download: "anglerbook-submission-" +
        slug(payload.submission.brand) + "-" + slug(payload.submission.model.model) + ".json" });
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      flashSuccess("Submission JSON downloaded. Attach it to an email to " + SUBMIT_EMAIL + ", or use “Email submission”.");
      return;
    }

    // email mode → open mailto with prefilled body
    var subject = "AnglerBook catalog submission — " + payload.submission.brand + " " + payload.submission.model.model;
    var body = "Hello AnglerBook catalog team,\n\n" +
      "We'd like to submit the following product line for the Gear Archive.\n\n" +
      "Contact: " + payload.contact.name + " <" + payload.contact.email + ">\n" +
      (payload.contact.website ? "Website: " + payload.contact.website + "\n" : "") +
      "\nStructured submission (JSON):\n\n" + json + "\n";
    var href = "mailto:" + SUBMIT_EMAIL +
      "?subject=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(body);
    window.location.href = href;
    flashSuccess("Your email client should now open with the submission prefilled. " +
      "If it doesn't, use “Download JSON” and email it to " + SUBMIT_EMAIL + ".");
  }

  function flashSuccess(msg) {
    var actions = $(".form-actions");
    var existing = $("#submit-success");
    if (existing) existing.remove();
    var note = el("div", { id: "submit-success", class: "form-success", text: msg });
    actions.parentNode.insertBefore(note, actions.nextSibling);
  }

  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
  }

  // ---- Go ---------------------------------------------------------------
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
  } else {
    load();
  }
})();
