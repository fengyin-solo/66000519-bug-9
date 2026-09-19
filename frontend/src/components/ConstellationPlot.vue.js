/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, computed, watch, onMounted, onActivated } from 'vue';
import { useSignalStore } from '../store/signal';
const store = useSignalStore();
const cvs = ref();
// 向上取整到 1/1.5/2/2.5/3/4/5/6/8 ×10^k 的"好看"量程
function niceCeil(v) {
    if (!isFinite(v) || v <= 0)
        return 1;
    const base = 10 ** Math.floor(Math.log10(v));
    for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
        if (m * base >= v * 0.999999999)
            return parseFloat((m * base).toPrecision(12));
    }
    return 10 * base;
}
function fmtTick(v, range) {
    const digits = range >= 10 ? 0 : range >= 1 ? 1 : 2;
    const s = v.toFixed(digits);
    return parseFloat(s) === 0 ? (0).toFixed(digits) : s;
}
// 量程与越界划分随数据一起计算，画布绘制和文字说明共用同一份结果
const model = computed(() => {
    const pts = store.result?.constellation;
    if (!pts || pts.length === 0)
        return null;
    const mags = pts.map(p => Math.max(Math.abs(p.i), Math.abs(p.q)));
    const maxAbs = Math.max(...mags);
    const sorted = [...mags].sort((a, b) => a - b);
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
    // 个别极端离群点不拖垮整体比例，超出部分单独统计说明
    const range = p95 > 0 && maxAbs > p95 * 3 ? niceCeil(p95 * 1.3) : niceCeil(maxAbs * 1.1);
    const inliers = [];
    const outliers = [];
    for (const p of pts) {
        (Math.abs(p.i) > range || Math.abs(p.q) > range ? outliers : inliers).push(p);
    }
    return { range, inliers, outliers, total: pts.length };
});
const scaleNote = computed(() => {
    const m = model.value;
    if (!m)
        return null;
    let s = `量程 ±${fmtTick(m.range, m.range)} · 共 ${m.total} 点`;
    if (m.outliers.length)
        s += ` · ${m.outliers.length} 点越界，已按边缘 ▲ 标记`;
    return s;
});
function draw() {
    const c = cvs.value;
    if (!c)
        return;
    const ctx = c.getContext('2d');
    if (!ctx)
        return;
    const W = c.width, H = c.height;
    // 每次先整体清空，避免旧图形残留或叠加
    ctx.fillStyle = '#0d1520';
    ctx.fillRect(0, 0, W, H);
    const m = model.value;
    if (!m) {
        // 空态：明确说明而不是留白
        ctx.fillStyle = '#5a6a7a';
        ctx.textAlign = 'center';
        ctx.font = '13px system-ui';
        ctx.fillText('暂无星座数据', W / 2, H / 2 - 4);
        ctx.font = '11px system-ui';
        ctx.fillText('点击「生成信号并分析」后显示', W / 2, H / 2 + 16);
        ctx.textAlign = 'start';
        return;
    }
    const { range } = m;
    // 布局边距与量程在同一处派生，缩放范围变化时刻度/网格同步调整
    const padL = 36, padR = 10, padT = 12, padB = 22;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const half = Math.min(plotW, plotH) / 2;
    const cx = padL + plotW / 2, cy = padT + plotH / 2;
    const toX = (i) => cx + (i / range) * half;
    const toY = (q) => cy - (q / range) * half;
    const clamp = (v) => Math.max(-range, Math.min(range, v));
    // 网格与刻度：位置由量程决定，标注值即真实坐标
    ctx.font = '9px system-ui';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#7a8a9a';
    const ticks = [-1, -0.5, 0, 0.5, 1];
    ctx.textAlign = 'center';
    for (const t of ticks) {
        const x = toX(t * range);
        ctx.beginPath();
        ctx.moveTo(x, cy - half);
        ctx.lineTo(x, cy + half);
        ctx.strokeStyle = t === 0 ? '#2a3a4a' : '#1c2836';
        ctx.stroke();
        ctx.fillText(fmtTick(t * range, range), x, cy + half + 12);
    }
    ctx.textAlign = 'right';
    for (const t of ticks) {
        if (t === 0)
            continue;
        const y = toY(t * range);
        ctx.beginPath();
        ctx.moveTo(cx - half, y);
        ctx.lineTo(cx + half, y);
        ctx.strokeStyle = '#1c2836';
        ctx.stroke();
        ctx.fillText(fmtTick(t * range, range), cx - half - 4, y + 3);
    }
    ctx.strokeStyle = '#2a3a4a';
    ctx.strokeRect(cx - half, cy - half, half * 2, half * 2);
    // 量程内的点
    for (const p of m.inliers) {
        ctx.beginPath();
        ctx.arc(toX(p.i), toY(p.q), 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#42a5f5';
        ctx.fill();
    }
    // 越界点：钳制到边缘，用橙色三角区分
    for (const p of m.outliers) {
        const x = toX(clamp(p.i)), y = toY(clamp(p.q));
        ctx.beginPath();
        ctx.moveTo(x, y - 4);
        ctx.lineTo(x - 4, y + 3);
        ctx.lineTo(x + 4, y + 3);
        ctx.closePath();
        ctx.fillStyle = '#ffb74d';
        ctx.fill();
    }
    ctx.fillStyle = '#8899aa';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'right';
    ctx.fillText('I →', cx + half, cy - 6);
    ctx.textAlign = 'left';
    ctx.fillText('Q ↑', cx + 6, cy - half + 12);
    ctx.textAlign = 'start';
}
onMounted(draw);
onActivated(draw);
watch(() => store.result, draw);
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "panel" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.canvas, __VLS_intrinsicElements.canvas)({
    ref: "cvs",
    width: "300",
    height: "300",
    ...{ class: "const-canvas" },
});
/** @type {typeof __VLS_ctx.cvs} */ ;
if (__VLS_ctx.scaleNote) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "scale-note" },
    });
    (__VLS_ctx.scaleNote);
}
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['const-canvas']} */ ;
/** @type {__VLS_StyleScopedClasses['scale-note']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            cvs: cvs,
            scaleNote: scaleNote,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
