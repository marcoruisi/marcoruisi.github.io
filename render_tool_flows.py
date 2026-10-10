#!/usr/bin/env python3
"""Static Tool Flows content. No uploads, automatic transfers or browser runtime."""
import html
import json
from pathlib import Path

FLOW_URLS = {"en": "/tool-flows/", "it": "/it/tool-flows/"}


def flow_page_content(root: Path, lang: str) -> str:
    if lang not in FLOW_URLS:
        raise ValueError(f"Unsupported Tool Flows language: {lang}")
    data = json.loads((root / "shared/tool-flows.json").read_text(encoding="utf-8"))
    if data.get("pages") != FLOW_URLS:
        raise ValueError("Tool Flows page routes do not match the language pair")
    tools = {t["id"]: t for t in json.loads((root / "shared/tools.json").read_text(encoding="utf-8"))["tools"]}
    esc = html.escape
    it = lang == "it"
    pick = lambda a,b: a if it else b
    intro = pick("Uno strumento risolve un problema. Il suo risultato pu\u00f2 diventare il punto di partenza per un altro.", "One tool solves a problem. Its result can become the starting point for another.")
    out = [f'<header class="mrc-flows-intro"><h1>Tool Flows</h1><p class="intro mrc-flows-lead">{esc(intro)}</p></header>']
    out.append(f'<section class="mrc-flow-examples" aria-labelledby="mrc-flow-examples-heading"><h2 id="mrc-flow-examples-heading" class="mrc-flows-sr-only">{pick("Tre idee per iniziare", "Three ideas to get started")}</h2>')
    seen = set()
    for number, flow in enumerate(data["examples"], start=1):
        fid = flow["id"]
        if fid in seen or not fid.replace("-", "").isalnum():
            raise ValueError(f"Invalid/duplicate flow ID: {fid}")
        seen.add(fid)
        title = esc(flow["title"][lang])
        out.append(f'<article class="mrc-flow-example" aria-labelledby="flow-{fid}"><div class="mrc-flow-example-heading"><span class="mrc-flow-number" aria-hidden="true">{number:02d}</span><h3 id="flow-{fid}">{title}</h3></div><p class="mrc-flow-description">{esc(flow["description"][lang])}</p>')
        out.append(f'<ol class="mrc-flow-path" aria-label="{title}">')
        for index, step in enumerate(flow["steps"]):
            kind = step["kind"]
            if kind not in ("input", "tool", "output"):
                raise ValueError(f"Invalid flow step kind: {kind}")
            arrow = '' if index == 0 else '<span class="mrc-flow-arrow" aria-hidden="true"><span class="mrc-flow-arrow-horizontal">&rarr;</span><span class="mrc-flow-arrow-vertical">&darr;</span></span>'
            label, detail = esc(step["label"][lang]), esc(step["detail"][lang])
            if kind == "tool":
                tool = tools[step["tool"]]
                route = tool["url"][lang]
                if not (root / route.strip("/") / "index.html").is_file():
                    raise ValueError(f"Missing linked tool: {route}")
                role = pick("Strumento", "Tool")
                element = f'<a class="mrc-flow-node" href="{esc(route, quote=True)}" aria-label="{esc(tool["name"][lang], quote=True)}"><span class="mrc-flow-node-kind">{role}</span><span class="mrc-flow-node-label">{label}<span class="mrc-flow-open" aria-hidden="true"> \u2197</span></span><span class="mrc-flow-node-detail">{detail}</span></a>'
            else:
                role = pick("Input \u00b7 Partenza", "Input \u00b7 Start") if kind == "input" else pick("Output \u00b7 Risultato", "Output \u00b7 Result")
                element = f'<div class="mrc-flow-node"><span class="mrc-flow-node-kind">{role}</span><span class="mrc-flow-node-label">{label}</span><span class="mrc-flow-node-detail">{detail}</span></div>'
            out.append(f'<li class="mrc-flow-step mrc-flow-step--{kind}">{arrow}{element}</li>')
        out.append('</ol>')
        if flow.get("note"):
            out.append(f'<p class="mrc-flow-note">{esc(flow["note"][lang])}</p>')
        out.append('</article>')
    out.append('</section>')
    heading = pick("Il flusso pi\u00f9 utile potrebbe essere quello che non abbiamo immaginato.", "The most useful flow might be one we haven\u2019t imagined.")
    paragraph = pick("Questi sono soltanto tre esempi, non percorsi obbligati. I Tools funzionano da soli, ma puoi collegarli e continuare anche con strumenti esterni. Scegli tu le combinazioni, in base al risultato che ti serve.", "These are just three examples, not fixed routes. Each tool works on its own, but you can connect them and carry on with tools from elsewhere. Choose the combinations that suit what you need to achieve.")
    handoff = pick("Un copia e incolla o un file scaricato possono bastare. Controlla il formato richiesto dal passaggio successivo: non ogni risultato entra in ogni strumento.", "Copy and paste, or a downloaded file, may be all you need. Check the format required by the next step: not every result fits every tool.")
    out.append(f'<section class="mrc-flows-outro" aria-labelledby="mrc-flows-outro-heading"><p class="mrc-flows-eyebrow">{pick("I collegamenti li trovi tu", "The connections are yours to find")}</p><h2 id="mrc-flows-outro-heading">{esc(heading)}</h2><p>{esc(paragraph)}</p><p class="mrc-flows-handoff">{esc(handoff)}</p><nav class="mrc-flows-links" aria-label="{pick("Continua a esplorare", "Keep exploring")}"><a class="mrc-flows-primary-link" href="{pick("/it/tools/tutti/", "/tools/all/")}">{pick("Esplora tutti i Tools", "Explore all the Tools")} \u2192</a><a href="{pick("/it/storie/connessioni/", "/stories/connections/")}">{pick("Leggi la storia Connessioni", "Read the Connections story")} \u2192</a></nav></section>')
    return "\n".join(out)
