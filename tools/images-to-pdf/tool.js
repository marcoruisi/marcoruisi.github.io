(() => {
    'use strict';
    const it = document.documentElement.lang === 'it';
    const words = it ? {
        ready: 'immagini pronte', one: 'immagine pronta', page: 'Pagina', up: 'Sposta su', down: 'Sposta giù', rotate: 'Ruota', remove: 'Rimuovi',
        reading: 'Sto preparando le immagini…', building: 'Sto creando il PDF…', progress: 'Pagina', of: 'di', done: 'PDF pronto. Controllalo prima di inviarlo.',
        unsupported: 'Formato non supportato. Scegli immagini JPG, PNG o WebP. Per HEIC, esporta prima la foto in JPG.', unreadable: 'Non riesco a leggere questa immagine. Prova ad aprirla o a esportarla di nuovo.',
        memory: 'Questa immagine è troppo grande per essere elaborata qui. Prova una copia ridotta.', failed: 'Non riesco a creare il PDF in questo browser. Prova meno immagini alla volta o un altro browser.',
        library: 'Il componente per creare PDF non è stato caricato. Ricarica la pagina e riprova.', size: 'Dimensione', pages: 'pagine', pageOne: 'pagina',
        added: 'Puoi aggiungere altre immagini, cambiare l’ordine o creare il PDF.'
    } : {
        ready: 'images ready', one: 'image ready', page: 'Page', up: 'Move up', down: 'Move down', rotate: 'Rotate', remove: 'Remove',
        reading: 'Preparing your images…', building: 'Creating your PDF…', progress: 'Page', of: 'of', done: 'Your PDF is ready. Check it before sending it.',
        unsupported: 'Unsupported format. Choose JPG, PNG or WebP images. For HEIC, export the photo as JPG first.', unreadable: 'This image could not be read. Try opening it or exporting it again.',
        memory: 'This image is too large to process here. Try a smaller copy.', failed: 'The PDF could not be created in this browser. Try fewer images at a time or another browser.',
        library: 'The PDF component did not load. Reload the page and try again.', size: 'Size', pages: 'pages', pageOne: 'page',
        added: 'You can add more images, change the order, or create the PDF.'
    };
    const input = document.getElementById('files');
    const add = document.getElementById('choose');
    const list = document.getElementById('image-list');
    const count = document.getElementById('count');
    const status = document.getElementById('status');
    const errors = document.getElementById('errors');
    const create = document.getElementById('create');
    const clear = document.getElementById('clear');
    const dropzone = document.getElementById('dropzone');
    const result = document.getElementById('result');
    const download = document.getElementById('download');
    const summary = document.getElementById('summary');
    const items = [];
    let busy = false;
    let resultUrl = null;
    const pause = () => new Promise(resolve => setTimeout(resolve, 0));
    function discardResult() {
        if (resultUrl) URL.revokeObjectURL(resultUrl);
        resultUrl = null;
        download.removeAttribute('href');
        result.hidden = true;
    }
    function setBusy(value) {
        busy = value;
        add.disabled = value;
        input.disabled = value;
        create.disabled = value || !items.length;
        clear.disabled = value || !items.length;
        list.querySelectorAll('button').forEach(button => { button.disabled = value || button.dataset.boundary === 'true'; });
        document.getElementById('workspace').setAttribute('aria-busy', String(value));
    }
    function render() {
        list.replaceChildren();
        items.forEach((item, index) => {
            const row = document.createElement('li');
            row.className = 'image-row';
            const image = document.createElement('img');
            image.src = item.thumb;
            image.alt = '';
            image.style.transform = `rotate(${item.rotation}deg)`;
            const body = document.createElement('div');
            const name = document.createElement('p');
            name.className = 'file-name';
            name.textContent = `${words.page} ${index + 1} · ${item.file.name}`;
            const actions = document.createElement('div');
            actions.className = 'row-actions';
            function button(text, label, fn, boundary = false) {
                const control = document.createElement('button');
                control.type = 'button';
                control.textContent = text;
                control.setAttribute('aria-label', `${label} · ${words.page} ${index + 1}`);
                control.disabled = boundary || busy;
                control.dataset.boundary = String(boundary);
                control.addEventListener('click', () => {
                    discardResult();
                    status.textContent = '';
                    fn();
                    render();
                    const next = list.children[Math.min(index, items.length - 1)];
                    if (next) next.querySelector('button:not(:disabled)')?.focus();
                    else add.focus();
                });
                actions.append(control);
            }
            button('↑', words.up, () => { [items[index - 1], items[index]] = [items[index], items[index - 1]]; }, index === 0);
            button('↓', words.down, () => { [items[index], items[index + 1]] = [items[index + 1], items[index]]; }, index === items.length - 1);
            button(words.rotate, words.rotate, () => { item.rotation = (item.rotation + 90) % 360; });
            button(words.remove, words.remove, () => { URL.revokeObjectURL(item.thumb); items.splice(index, 1); });
            body.append(name, actions);
            row.append(image, body);
            list.append(row);
        });
        count.textContent = items.length ? `${items.length} ${items.length === 1 ? words.one : words.ready}` : '';
        setBusy(busy);
    }
    async function withImage(file, action) {
        const url = URL.createObjectURL(file);
        const image = new Image();
        try {
            await new Promise((resolve, reject) => {
                image.onload = resolve;
                image.onerror = () => reject(new Error(words.unreadable));
                image.src = url;
            });
            if (!image.naturalWidth || !image.naturalHeight) throw new Error(words.unreadable);
            // Technical memory protection, never a paid-plan limit.
            if (image.naturalWidth * image.naturalHeight > 80000000) throw new Error(words.memory);
            return await action(image);
        } finally {
            image.src = '';
            URL.revokeObjectURL(url);
        }
    }
    async function supported(file) {
        const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
        return (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
            (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) ||
            (String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP');
    }
    function asBlob(canvas, type, quality) {
        return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error(words.memory)), type, quality));
    }
    async function addFiles(files) {
        if (busy || !files.length) return;
        discardResult();
        errors.replaceChildren();
        setBusy(true);
        status.textContent = words.reading;
        for (const file of files) {
            try {
                if (!await supported(file)) throw new Error(words.unsupported);
                const thumb = await withImage(file, async image => {
                    const scale = Math.min(1, 240 / Math.max(image.naturalWidth, image.naturalHeight));
                    const canvas = document.createElement('canvas');
                    try {
                        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
                        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
                        const context = canvas.getContext('2d');
                        if (!context) throw new Error(words.memory);
                        context.drawImage(image, 0, 0, canvas.width, canvas.height);
                        return URL.createObjectURL(await asBlob(canvas, 'image/png'));
                    } finally { canvas.width = canvas.height = 0; }
                });
                items.push({file, thumb, rotation: 0});
            } catch (error) {
                const message = document.createElement('li');
                message.textContent = `${file.name}: ${error.message || words.unreadable}`;
                errors.append(message);
            }
            await pause();
        }
        setBusy(false);
        render();
        status.textContent = items.length ? words.added : '';
        input.value = '';
    }
    add.addEventListener('click', () => input.click());
    input.addEventListener('change', () => addFiles([...input.files]));
    ['dragenter', 'dragover'].forEach(event => dropzone.addEventListener(event, e => { e.preventDefault(); if (!busy) dropzone.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach(event => dropzone.addEventListener(event, e => { e.preventDefault(); dropzone.classList.remove('drag'); }));
    dropzone.addEventListener('drop', event => addFiles([...event.dataTransfer.files]));
    clear.addEventListener('click', () => {
        items.forEach(item => URL.revokeObjectURL(item.thumb));
        items.length = 0;
        discardResult();
        errors.replaceChildren();
        status.textContent = '';
        input.value = '';
        render();
        add.focus();
    });
    create.addEventListener('click', async () => {
        if (busy || !items.length) return;
        discardResult();
        setBusy(true);
        status.textContent = words.building;
        try {
            if (!window.PDFLib) throw new Error(words.library);
            const pdf = await window.PDFLib.PDFDocument.create();
            pdf.setCreator('MRC Images to PDF');
            pdf.setProducer('pdf-lib');
            // No file names, EXIF, GPS or original photo metadata copied into the PDF.
            for (let index = 0; index < items.length; index++) {
                status.textContent = `${words.progress} ${index + 1} ${words.of} ${items.length}…`;
                const item = items[index];
                await withImage(item.file, async image => {
                    const sideways = item.rotation % 180 !== 0;
                    const sourceW = sideways ? image.naturalHeight : image.naturalWidth;
                    const sourceH = sideways ? image.naturalWidth : image.naturalHeight;
                    const scale = Math.min(1, 3600 / Math.max(sourceW, sourceH));
                    const canvas = document.createElement('canvas');
                    try {
                        canvas.width = Math.max(1, Math.round(sourceW * scale));
                        canvas.height = Math.max(1, Math.round(sourceH * scale));
                        const ctx = canvas.getContext('2d');
                        if (!ctx) throw new Error(words.memory);
                        ctx.fillStyle = '#fff';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.translate(canvas.width / 2, canvas.height / 2);
                        ctx.rotate(item.rotation * Math.PI / 180);
                        ctx.drawImage(image, -image.naturalWidth * scale / 2, -image.naturalHeight * scale / 2, image.naturalWidth * scale, image.naturalHeight * scale);
                        const blob = await asBlob(canvas, 'image/jpeg', 0.92);
                        const embedded = await pdf.embedJpg(await blob.arrayBuffer());
                        const pageSize = sourceW > sourceH ? [841.89, 595.28] : [595.28, 841.89];
                        const page = pdf.addPage(pageSize);
                        const fit = Math.min((pageSize[0] - 36) / embedded.width, (pageSize[1] - 36) / embedded.height);
                        const width = embedded.width * fit, height = embedded.height * fit;
                        page.drawImage(embedded, {x: (pageSize[0] - width) / 2, y: (pageSize[1] - height) / 2, width, height});
                    } finally { canvas.width = canvas.height = 0; }
                });
                await pause();
            }
            MRCOutputMetadata.pdf(pdf);
            const bytes = await pdf.save();
            const blob = new Blob([bytes], {type: 'application/pdf'});
            resultUrl = URL.createObjectURL(blob);
            download.href = resultUrl;
            download.download = it ? 'immagini.pdf' : 'images.pdf';
            const unit = blob.size < 1024 * 1024 ? 'KB' : 'MB';
            const size = new Intl.NumberFormat(it ? 'it' : 'en', {maximumFractionDigits: 1}).format(blob.size / (unit === 'KB' ? 1024 : 1024 * 1024));
            summary.textContent = `${items.length} ${items.length === 1 ? words.pageOne : words.pages} · ${words.size}: ${size} ${unit}`;
            result.hidden = false;
            status.textContent = words.done;
            download.focus();
        } catch (error) {
            status.textContent = [words.memory, words.library, words.unreadable].includes(error.message) ? error.message : words.failed;
        } finally { setBusy(false); }
    });
    render();
})();
