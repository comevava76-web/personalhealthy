package ch.personalhealthy.app

import android.content.Context
import android.content.Intent
import android.graphics.Canvas
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileOutputStream
import java.time.Instant
import java.time.LocalDate
import java.time.temporal.ChronoUnit

class ChartPal(val bg: Int, val grid: Int, val text: Int, val sys: Int, val dia: Int, val stick: Int)

val SCREEN_PAL = ChartPal(
    bg = 0xFF172B50.toInt(), grid = 0x14EAF0FA, text = 0xFF9AAACA.toInt(),
    sys = 0xFFFF7086.toInt(), dia = 0xFF62B6FF.toInt(), stick = 0x30EAF0FA
)
val PRINT_PAL = ChartPal(
    bg = 0xFFFFFFFF.toInt(), grid = 0xFFE6EBF2.toInt(), text = 0xFF5B6B88.toInt(),
    sys = 0xFFD93A52.toInt(), dia = 0xFF2F7FD6.toInt(), stick = 0x2E13223F
)

/** Grafico unico per schermo e PDF: fascia tra minima e massima, linee, soglie 135/85, picco. */
fun drawBpChart(c: Canvas, w: Float, h: Float, list: List<Reading>, start: LocalDate, days: Int, pal: ChartPal, fs: Float) {
    val p = Paint(Paint.ANTI_ALIAS_FLAG)
    p.color = pal.bg
    c.drawRect(0f, 0f, w, h, p)

    val padL = fs * 3.2f
    val padR = fs * 1.2f
    val padT = fs * 1.8f
    val padB = fs * 2.6f
    val cw = w - padL - padR
    val ch = h - padT - padB

    val vals = list.flatMap { listOf(it.sis, it.dia) }
    val lo = ((minOf(vals.minOrNull() ?: 70, 70) - 10) / 10) * 10
    val hi = ((maxOf(vals.maxOrNull() ?: 150, 150) + 19) / 10) * 10
    fun y(v: Int): Float = padT + ch * (1f - (v - lo).toFloat() / (hi - lo).toFloat())
    fun x(ts: Long): Float {
        val z = Instant.ofEpochMilli(ts).atZone(Z.zone)
        val di = ChronoUnit.DAYS.between(start, z.toLocalDate()).toFloat()
        val hf = (z.hour + z.minute / 60f) / 24f
        return padL + cw * (di + hf) / days
    }

    val text = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = pal.text; textSize = fs }
    val line = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = pal.grid; strokeWidth = 1f; style = Paint.Style.STROKE }

    // griglia orizzontale
    val step = if (hi - lo > 120) 30 else 20
    var v = ((lo + step - 1) / step) * step
    text.textAlign = Paint.Align.RIGHT
    while (v <= hi) {
        c.drawLine(padL, y(v), w - padR, y(v), line)
        c.drawText(v.toString(), padL - fs * 0.5f, y(v) + fs * 0.35f, text)
        v += step
    }

    // giorni
    text.textAlign = Paint.Align.CENTER
    val every = if (days <= 7) 1 else if (days <= 15) 2 else 4
    for (i in 0 until days) {
        val x0 = padL + cw * i / days
        if (i > 0) c.drawLine(x0, padT, x0, padT + ch, line)
        if (i % every == 0 || i == days - 1) {
            val d = start.plusDays(i.toLong())
            val lab = if (days <= 7) "${Z.weekday(d)} ${d.dayOfMonth}" else d.dayOfMonth.toString()
            c.drawText(lab, x0 + cw / days / 2f, padT + ch + fs * 1.6f, text)
        }
    }

    // soglie tratteggiate
    val dash = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE; strokeWidth = fs * 0.1f; pathEffect = DashPathEffect(floatArrayOf(fs * 0.5f, fs * 0.5f), 0f)
    }
    if (SOGLIA_SIS in (lo + 1) until hi) { dash.color = pal.sys; dash.alpha = 140; c.drawLine(padL, y(SOGLIA_SIS), w - padR, y(SOGLIA_SIS), dash) }
    if (SOGLIA_DIA in (lo + 1) until hi) { dash.color = pal.dia; dash.alpha = 140; c.drawLine(padL, y(SOGLIA_DIA), w - padR, y(SOGLIA_DIA), dash) }

    if (list.isEmpty()) return
    val pts = list.sortedBy { it.takenAt }

    // fascia minima-massima
    val bw = (cw / days / 6f).coerceIn(fs * 0.3f, fs * 0.8f)
    val stick = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = pal.stick }
    pts.forEach { r ->
        val cx = x(r.takenAt)
        c.drawRoundRect(RectF(cx - bw / 2, y(r.sis), cx + bw / 2, y(r.dia)), bw / 2, bw / 2, stick)
    }

    // linee e punti
    fun series(pick: (Reading) -> Int, col: Int, limit: Int) {
        val lp = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = col; alpha = 140; strokeWidth = fs * 0.16f; style = Paint.Style.STROKE }
        val path = Path()
        pts.forEachIndexed { i, r -> if (i == 0) path.moveTo(x(r.takenAt), y(pick(r))) else path.lineTo(x(r.takenAt), y(pick(r))) }
        c.drawPath(path, lp)
        val fill = Paint(Paint.ANTI_ALIAS_FLAG)
        val ring = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = col; style = Paint.Style.STROKE; strokeWidth = fs * 0.18f }
        pts.forEach { r ->
            fill.color = if (pick(r) >= limit) col else pal.bg
            c.drawCircle(x(r.takenAt), y(pick(r)), fs * 0.36f, fill)
            c.drawCircle(x(r.takenAt), y(pick(r)), fs * 0.36f, ring)
        }
    }
    series({ it.sis }, pal.sys, SOGLIA_SIS)
    series({ it.dia }, pal.dia, SOGLIA_DIA)

    // picco della massima
    val pk = pts.maxBy { it.sis }
    val ring = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = pal.sys; style = Paint.Style.STROKE; strokeWidth = fs * 0.12f }
    c.drawCircle(x(pk.takenAt), y(pk.sis), fs * 0.85f, ring)
    val lab = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = pal.sys; textSize = fs; typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD); textAlign = Paint.Align.CENTER
    }
    val px = x(pk.takenAt).coerceIn(padL + fs * 2.5f, w - padR - fs * 2.5f)
    c.drawText(t(R.string.peak_label, pk.sis), px, maxOf(y(pk.sis) - fs * 1.1f, fs + 2f), lab)
}

/* ---------------- PDF ---------------- */

fun buildPdf(ctx: Context, all: List<Reading>, n: Int): File {
    val per = periodInfo(all, n)
    val st = stats(per.list)
    val doc = PdfDocument()
    var pageNo = 1
    val left = 40f
    val right = 555f

    val title = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFF13223F.toInt(); textSize = 18f; typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD) }
    val sub = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFF5B6B88.toInt(); textSize = 10.5f }
    val small = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFF8C96AA.toInt(); textSize = 8f }
    val label = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFF5B6B88.toInt(); textSize = 10.5f }
    val value = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFF13223F.toInt(); textSize = 10.5f; typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD) }

    fun footer(c: Canvas) {
        c.drawText(t(R.string.pdf_footer), left, 822f, small)
    }

    // pagina 1: riepilogo e grafico
    var page = doc.startPage(PdfDocument.PageInfo.Builder(595, 842, pageNo++).create())
    var c = page.canvas
    c.drawText(t(R.string.pdf_title), left, 60f, title)
    c.drawText(t(R.string.pdf_period, n, Z.long(per.start), Z.long(per.end)), left, 80f, sub)
    c.drawText(t(R.string.pdf_counts, st.n, st.days), left, 96f, sub)

    c.save()
    c.translate(left, 112f)
    drawBpChart(c, right - left, 250f, per.list, per.start, n, PRINT_PAL, 9f)
    c.restore()
    c.drawText(t(R.string.pdf_legend), left, 378f, small)

    fun f(r: Reading?) = if (r == null) "-" else "${r.sis}/${r.dia}  (${t(R.string.when_fmt, Z.dmy(Z.date(r.takenAt)), Z.time(r.takenAt))})"
    val rows = listOf(
        t(R.string.period_avg) to "${st.sis ?: "-"}/${st.dia ?: "-"} mmHg",
        t(R.string.avg_morning) to (if (st.mN > 0) "${st.mS}/${st.mD} mmHg  (${t(R.string.readings_short, st.mN)})" else "-"),
        t(R.string.avg_evening) to (if (st.eN > 0) "${st.eS}/${st.eD} mmHg  (${t(R.string.readings_short, st.eN)})" else "-"),
        t(R.string.avg_pulse) to (st.pul?.let { t(R.string.per_min_short, it) } ?: "-"),
        t(R.string.peak_sys) to f(st.maxS),
        t(R.string.max_dia) to f(st.maxD),
        t(R.string.lowest) to f(st.minS),
        t(R.string.above_thr) to "${st.over} / ${st.n}"
    )
    var yy = 410f
    rows.forEach { (k, v) ->
        c.drawText(k, left, yy, label)
        c.drawText(v, 210f, yy, value)
        yy += 20f
    }
    footer(c)
    doc.finishPage(page)

    // pagine successive: tabella di tutte le misure
    val cols = floatArrayOf(left, 120f, 170f, 250f, 320f, 390f, 460f)
    val heads = listOf(t(R.string.col_date), t(R.string.col_time), t(R.string.col_period), t(R.string.legend_sys), t(R.string.legend_dia), t(R.string.label_pul), t(R.string.col_eval))
    val head = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFFFFFFF.toInt(); textSize = 10f; typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD) }
    val cell = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFF13223F.toInt(); textSize = 10f }
    val red = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFD93A52.toInt(); textSize = 10f; typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD) }
    val band = Paint().apply { color = 0xFFF4F7FC.toInt() }
    val headBg = Paint().apply { color = 0xFF13223F.toInt() }

    var i = 0
    val list = per.list
    while (i < list.size || i == 0) {
        page = doc.startPage(PdfDocument.PageInfo.Builder(595, 842, pageNo++).create())
        c = page.canvas
        c.drawText(t(R.string.pdf_all), left, 56f, title)
        var y = 76f
        c.drawRect(left, y, right, y + 20f, headBg)
        heads.forEachIndexed { k, s -> c.drawText(s, cols[k] + 4f, y + 14f, head) }
        y += 20f
        var row = 0
        while (i < list.size && y < 790f) {
            val r = list[i]
            if (row % 2 == 1) c.drawRect(left, y, right, y + 18f, band)
            val cells = listOf(Z.dmy(Z.date(r.takenAt)), Z.time(r.takenAt), periodLabel(r.period), r.sis.toString(), r.dia.toString(), r.pul?.toString() ?: "-", classify(r.sis, r.dia).label)
            cells.forEachIndexed { k, s ->
                val pnt = when {
                    k == 3 && r.sis >= SOGLIA_SIS -> red
                    k == 4 && r.dia >= SOGLIA_DIA -> red
                    else -> cell
                }
                c.drawText(s, cols[k] + 4f, y + 13f, pnt)
            }
            y += 18f; i++; row++
        }
        footer(c)
        doc.finishPage(page)
        if (list.isEmpty()) break
    }

    val dir = File(ctx.cacheDir, "reports").apply { mkdirs() }
    val file = File(dir, "blood-pressure_${n}d_${per.end}.pdf")
    FileOutputStream(file).use { doc.writeTo(it) }
    doc.close()
    return file
}

/* ---------------- CSV per Excel ---------------- */

fun buildCsv(ctx: Context, all: List<Reading>, n: Int): File {
    val per = periodInfo(all, n)
    val sb = StringBuilder("\uFEFF")
    sb.append(listOf(t(R.string.col_date), t(R.string.col_time), t(R.string.col_period), t(R.string.legend_sys) + " (mmHg)", t(R.string.legend_dia) + " (mmHg)", t(R.string.label_pul), t(R.string.col_eval)).joinToString(";"))
    sb.append("\r\n")
    per.list.forEach { r ->
        sb.append(listOf(Z.dmy(Z.date(r.takenAt)), Z.time(r.takenAt), periodLabel(r.period), r.sis, r.dia, r.pul ?: "", classify(r.sis, r.dia).label).joinToString(";"))
        sb.append("\r\n")
    }
    val dir = File(ctx.cacheDir, "reports").apply { mkdirs() }
    val file = File(dir, "blood-pressure_${n}d_${per.end}.csv")
    file.writeText(sb.toString(), Charsets.UTF_8)
    return file
}

fun shareFile(ctx: Context, file: File, mime: String) {
    val uri = FileProvider.getUriForFile(ctx, ctx.packageName + ".files", file)
    val send = Intent(Intent.ACTION_SEND).apply {
        type = mime
        putExtra(Intent.EXTRA_STREAM, uri)
        putExtra(Intent.EXTRA_SUBJECT, t(R.string.report_subject))
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    ctx.startActivity(Intent.createChooser(send, t(R.string.share_title)))
}
