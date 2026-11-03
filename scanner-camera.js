/* Lightweight geometry polling; recognition runs only after a stable card appears. */
(function (root) {
    class CameraScanner {
        constructor({onStatus, onCapture, onDetection = () => {}, fetcher = (...args) => fetch(...args)}) {
            this.onStatus = onStatus; this.onCapture = onCapture; this.onDetection = onDetection; this.fetcher = fetcher;
            this.generation = 0;
        }
        stop() {
            this.generation++;
            clearTimeout(this.timer); this.controller?.abort();
            this.previous = null; this.samples = []; this.readyCount = 0;
            this.lastSignature = null; this.lastRecognitionAt = 0; this.missingSince = 0;
            this.manualSelection = false;
            this.onDetection(null);
        }
        async signature(image) {
            if (typeof Image === 'undefined') return null;
            const img = new Image(); img.src = image; await img.decode();
            const canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 24;
            const ctx = canvas.getContext('2d', {willReadFrequently:true});
            ctx.drawImage(img, 0, 0, 16, 24);
            const pixels = ctx.getImageData(0,0,16,24).data;
            return Array.from({length:384}, (_,i) => (pixels[i*4]+pixels[i*4+1]+pixels[i*4+2])/3);
        }
        static sameImage(a,b) {
            return !!a && !!b && a.length === b.length && a.reduce((sum,x,i)=>sum+Math.abs(x-b[i]),0)/a.length < 3;
        }
        start(video) {
            this.stop(); this.video = video;
            this.canvas = document.createElement('canvas');
            this.poll(this.generation);
        }
        static stable(left, right) {
            if (!left || !right || left.length !== 4 || right.length !== 4) return false;
            // The detector may choose another starting corner for the same outline.
            return [right, [...right].reverse()].some(points =>
                [0,1,2,3].some(offset => left.every((point,i) => {
                    const other = points[(i+offset)%4];
                    return Math.hypot(point[0]-other[0], point[1]-other[1]) < .05;
                })));

        }
        async poll(generation) {
            if (generation !== this.generation) return;
            const video = this.video;
            try {
                if (document.hidden || !video.videoWidth || video.paused) {
                    this.previous = null; this.samples = []; return;
                }
                const scale = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight));
                this.canvas.width = Math.round(video.videoWidth * scale);
                this.canvas.height = Math.round(video.videoHeight * scale);
                this.canvas.getContext('2d').drawImage(video, 0, 0, this.canvas.width, this.canvas.height);
                const controller = new AbortController();
                this.controller = controller;
                const timeout = setTimeout(() => controller.abort(), 4500);
                let response, result;
                try {
                    response = await this.fetcher('/tcg-card-detect', {method: 'POST',
                        signal: controller.signal, headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({image: this.canvas.toDataURL('image/jpeg', .80)})});
                    result = await response.json();
                } finally {clearTimeout(timeout);}
                if (generation !== this.generation) return;
                if (!response.ok) throw new Error(result.error || 'Esperando al detector…');
                this.onDetection(result.detected === false ? null : result.quad || null);
                if (result.ready && result.image) {
                    this.missingSince = 0;
                    if (this.manualSelection) return;
                    this.readyCount = (this.readyCount || 0) + 1;
                    this.samples = CameraScanner.stable(this.previous, result.quad) ? [...this.samples, result.image] : [result.image];
                    this.previous = result.quad;
                    this.onStatus('Carta localizada. Mantenla quieta…');
                    if (this.samples.length >= 2 || this.readyCount >= 4) {
                        const samples = this.samples.length >= 2 ? this.samples.slice(-2) : [result.image];
                        // Keep the live session running after success, uncertainty or
                        // a transient failure. Awaiting prevents overlapping inference.
                        this.samples = []; this.previous = null; this.readyCount = 0;
                        const signature = await this.signature(result.image);
                        if (generation !== this.generation) return;
                        if (CameraScanner.sameImage(signature, this.lastSignature) && (this.lastRecognized || Date.now()-this.lastRecognitionAt < 1800)) return;
                        const recognized = await this.onCapture(samples);
                        if (generation === this.generation && typeof recognized === 'boolean') {
                            this.lastSignature = signature; this.lastRecognitionAt = Date.now();
                            this.lastRecognized = recognized;
                        }
                        return;
                    }
                } else {
                    this.previous = null; this.samples = []; this.readyCount = 0;
                    if (!result.detected) {
                        if (!this.missingSince) this.missingSince = Date.now();
                        if (Date.now()-this.missingSince > 1100) {this.lastSignature = null;this.manualSelection = false;}
                    }
                    this.onStatus(result.reason || 'Buscando una carta…');
                }
            } catch (error) {
                if (generation === this.generation) {
                    this.previous = null; this.samples = [];
                    this.onStatus(error.name === 'AbortError' ? 'El detector tarda en responder. Reintentando…' : error.message);
                }
            } finally {
                if (generation === this.generation) this.timer = setTimeout(() => this.poll(generation), 300);
            }
        }
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = CameraScanner;
    else root.CameraScanner = CameraScanner;
})(typeof window === 'undefined' ? globalThis : window);
