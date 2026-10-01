package ch.personalhealthy.app

import android.content.Context
import androidx.compose.ui.graphics.toArgb
import android.content.Intent
import android.graphics.Canvas
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
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.roundToInt
import kotlin.math.sign

class ChartPal(val bg: Int, val grid: Int, val text: Int, val outline: Int)

// Line colours on screen: those of the theme (object C), dark or light (the PDF has its own, P_* below)
val SYS_COLOR: Int get() = C.Sys.toArgb()    // systolic, violet
val DIA_COLOR: Int get() = C.Dia.toArgb()    // diastolic, teal
val PUL_COLOR: Int get() = C.Pul.toArgb()    // pulse, amber

val SCREEN_PAL: ChartPal get() = ChartPal(bg = C.Surface.toArgb(), grid = C.Ink.copy(alpha = 0.08f).toArgb(), text = C.Muted.toArgb(), outline = 0)

/** One point per day: the averages of that day's readings. */
class DayPoint(val day: LocalDate, val sis: Int, val dia: Int, val pul: Int?)

fun dailyAverages(list: List<Reading>): List<DayPoint> =
    list.groupBy { Z.date(it.takenAt) }.toSortedMap().map { (day, l) ->
        val pul = l.mapNotNull { it.pul }
        DayPoint(
            day, l.map { it.sis }.average().roundToInt(), l.map { it.dia }.average().roundToInt(),
            if (pul.isEmpty()) null else pul.average().roundToInt()
        )
    }

/**
 * The one blood-pressure chart, used on the Blood pressure tab, the Report tab and in the PDF.
 * Points are daily averages; smooth lines for systolic, diastolic and pulse (pulse can be left out) on one "mmHg / bpm" axis.
 * Plain background, no reference lines and no coloured zones: the app does not judge the values.
 * A grid line every 10 mmHg; up to 10 days, each day's systolic and diastolic are written next to the dots.
 * Only the day number under each day.
 */
fun drawBpChart(c: Canvas, w: Float, h: Float, list: List<Reading>, start: LocalDate, days: Int, pal: ChartPal, fs: Float, pulse: Boolean = true) {
    val p = Paint(Paint.ANTI_ALIAS_FLAG)
    p.color = pal.bg
    c.drawRect(0f, 0f, w, h, p)

    val padL = fs * 3.2f
    val padR = fs * 0.8f
    val padT = fs * 2.2f
    val padB = fs * 2.4f
    val cw = w - padL - padR
    val ch = h - padT - padB
    val right = padL + cw
    val bottom = padT + ch

    val pts = dailyAverages(list)
    val vals = pts.flatMap { listOfNotNull(it.sis, it.dia, if (pulse) it.pul else null) }
    val lo = ((minOf(vals.minOrNull() ?: 60, 60) - 10) / 10) * 10
    val hi = ((maxOf(vals.maxOrNull() ?: 150, 150) + 19) / 10) * 10
    fun y(v: Int): Float = padT + ch * (1f - (v - lo).toFloat() / (hi - lo).toFloat())
    val slot = cw / days
    fun x(d: LocalDate): Float = padL + slot * ChronoUnit.DAYS.between(start, d).toFloat() + slot / 2f

    val text = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = pal.text; textSize = fs }
    val line = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = pal.grid; strokeWidth = 1f; style = Paint.Style.STROKE }

    // shared vertical axis: unit on top, values on the horizontal grid lines
    text.textAlign = Paint.Align.LEFT
    c.drawText("mmHg / bpm", fs * 0.3f, fs * 1.2f, text)
    // a line and a number every 10 mmHg (120, 130, 140...): the scale can be read precisely
    val step = 10
    var v = ((lo + step - 1) / step) * step
    text.textAlign = Paint.Align.RIGHT
    while (v <= hi) {
        c.drawLine(padL, y(v), right, y(v), line)
        c.drawText(v.toString(), padL - fs * 0.5f, y(v) + fs * 0.35f, text)
        v += step
    }

    // days: thin separators, and only as many day numbers as fit without overlapping
    text.textAlign = Paint.Align.CENTER
    for (i in 1 until days) c.drawLine(padL + slot * i, padT, padL + slot * i, bottom, line)
    for (i in dayLabelIndexes(days, slot, text.measureText("00") + fs * 0.8f)) {
        c.drawText(start.plusDays(i.toLong()).dayOfMonth.toString(), padL + slot * i + slot / 2f, bottom + fs * 1.6f, text)
    }

    val sys = pts.map { x(it.day) to y(it.sis) }
    val dia = pts.map { x(it.day) to y(it.dia) }
    val pul = pts.mapNotNull { d -> d.pul?.let { x(d.day) to y(it) } }

    // smooth lines with a dot on each day (pulse first, so blood pressure stays on top)
    // thin lines and small dots: the exact position of each day stays readable
    fun series(values: List<Pair<Float, Float>>, col: Int) {
        if (values.isEmpty()) return
        val lp = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = col; strokeWidth = fs * 0.11f; style = Paint.Style.STROKE
            strokeJoin = Paint.Join.ROUND; strokeCap = Paint.Cap.ROUND
        }
        if (values.size > 1) c.drawPath(monotonePath(values), lp)
        val dot = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = col }
        val ring = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = if (pal.outline != 0) pal.outline else pal.bg; style = Paint.Style.STROKE; strokeWidth = fs * 0.08f }
        values.forEach { (px, py) ->
            c.drawCircle(px, py, fs * 0.24f, dot)
            c.drawCircle(px, py, fs * 0.24f, ring)
        }
    }
    if (pulse) series(pul, PUL_COLOR)
    series(dia, DIA_COLOR)
    series(sys, SYS_COLOR)

    // up to 10 days there is room to write each day's value: systolic above its dot, diastolic below
    if (days <= 10) {
        val lab = Paint(Paint.ANTI_ALIAS_FLAG).apply { textSize = fs * 0.85f; textAlign = Paint.Align.CENTER; typeface = Typeface.DEFAULT_BOLD }
        pts.forEach { d ->
            lab.color = SYS_COLOR
            c.drawText(d.sis.toString(), x(d.day), y(d.sis) - fs * 0.55f, lab)
            lab.color = DIA_COLOR
            c.drawText(d.dia.toString(), x(d.day), y(d.dia) + fs * 1.25f, lab)
        }
    }
}

/** Which days get a number: every n-th day so labels never overlap, always the first and the last. */
fun dayLabelIndexes(days: Int, slot: Float, labelWidth: Float): List<Int> {
    val every = maxOf(1, ceil(labelWidth / slot).toInt())
    val out = (0 until days step every).toMutableList()
    if (out.last() != days - 1) {
        if (out.size > 1 && days - 1 - out.last() < every) out.removeAt(out.size - 1)
        out.add(days - 1)
    }
    return out
}

/** Smooth line through the points without overshooting them (monotone cubic interpolation). */
fun monotonePath(pts: List<Pair<Float, Float>>): Path {
    val n = pts.size
    val path = Path()
    path.moveTo(pts[0].first, pts[0].second)
    val h = FloatArray(n - 1) { pts[it + 1].first - pts[it].first }
    val s = FloatArray(n - 1) { if (h[it] > 0f) (pts[it + 1].second - pts[it].second) / h[it] else 0f }
    val m = FloatArray(n)
    for (i in 1 until n - 1) {
        m[i] = if (s[i - 1] * s[i] <= 0f || h[i - 1] <= 0f || h[i] <= 0f) 0f else {
            val p = (s[i - 1] * h[i] + s[i] * h[i - 1]) / (h[i - 1] + h[i])
            2f * sign(s[i]) * minOf(abs(s[i - 1]), abs(s[i]), 0.5f * abs(p))
        }
    }
    fun end(sl: Float, next: Float): Float {
        val e = (3f * sl - next) / 2f
        return when {
            sign(e) != sign(sl) -> 0f
            abs(e) > 3f * abs(sl) -> 3f * sl
            else -> e
        }
    }
    if (n > 2) {
        m[0] = end(s[0], m[1])
        m[n - 1] = end(s[n - 2], m[n - 2])
    } else {
        m[0] = s[0]; m[1] = s[0]
    }
    for (i in 0 until n - 1) {
        val (x0, y0) = pts[i]
        val (x1, y1) = pts[i + 1]
        if (h[i] <= 0f) { path.lineTo(x1, y1); continue }
        val d = h[i] / 3f
        path.cubicTo(x0 + d, y0 + m[i] * d, x1 - d, y1 - m[i + 1] * d, x1, y1)
    }
    return path
}

/* ---------------- PDF ---------------- */

// print colours: a little deeper than on screen, so thin lines and small numbers read well on white paper
private const val P_SYS = 0xFF6D5BD0.toInt()
private const val P_DIA = 0xFF0F9C8E.toInt()
private const val P_PUL = 0xFFB7860B.toInt()
private const val P_SYS_T = 0xFF5543B8.toInt()
private const val P_DIA_T = 0xFF0B7A6F.toInt()
private const val P_PUL_T = 0xFF8F6806.toInt()
private const val P_INK = 0xFF13223F.toInt()
private const val P_MUTED = 0xFF5B6B88.toInt()
private const val P_RULE = 0xFFD9E0EA.toInt()
private const val P_PANEL = 0xFFF7F9FC.toInt()

/** One line of a PDF chart: which value, its name, the line colour and the colour of its numbers. */
private class Line(val name: String, val color: Int, val textColor: Int, val value: (Reading) -> Int?)

private fun pdfPaint(size: Float, color: Int = P_INK, bold: Boolean = false, align: Paint.Align = Paint.Align.LEFT, spacing: Float = 0f) =
    Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textSize = size; this.color = color; textAlign = align; letterSpacing = spacing
        typeface = Typeface.create(Typeface.DEFAULT, if (bold) Typeface.BOLD else Typeface.NORMAL)
    }

/**
 * A detailed chart for the PDF: every reading at its own day and hour, straight lines between them
 * (nothing smoothed or averaged), a fine grid every 5 and a number every 10.
 * The value is written next to each dot wherever it fits without covering another number or dot;
 * the highest and lowest of each line are placed first, so they are always there.
 */
private fun pdfChart(
    c: Canvas, x0: Float, y0: Float, w: Float, h: Float, list: List<Reading>, lines: List<Line>,
    title: String, sub: String, units: String, start: LocalDate, days: Int
) {
    c.drawText(title, x0, y0, pdfPaint(11.5f, bold = true))
    c.drawText(sub, x0 + w, y0, pdfPaint(8f, P_MUTED, align = Paint.Align.RIGHT))
    // legend: a short line with its dot, and the name
    var lx = x0
    val ly = y0 + 14f
    val legend = pdfPaint(8f, bold = true)
    for (l in lines) {
        c.drawRect(lx, ly - 6f, lx + 10f, ly - 3.8f, Paint().apply { color = l.color })
        dot(c, lx + 5f, ly - 4.9f, l.color)
        c.drawText(l.name, lx + 14f, ly - 2f, legend)
        lx += 14f + legend.measureText(l.name) + 14f
    }
    c.drawText(units, x0 + w, ly - 2f, pdfPaint(7f, P_MUTED, align = Paint.Align.RIGHT))

    val top = y0 + 24f
    val left = x0 + 26f
    val right = x0 + w - 8f
    val pt = top + 4f
    val pb = y0 + h - 22f
    c.drawRoundRect(RectF(x0, top, x0 + w, y0 + h), 4f, 4f, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = P_PANEL })

    val vals = list.flatMap { r -> lines.mapNotNull { it.value(r) } }
    if (vals.isEmpty()) {
        c.drawText(t(R.string.pdf_none_moment), x0 + w / 2f, (top + pb) / 2f, pdfPaint(9f, P_MUTED, align = Paint.Align.CENTER))
        return
    }
    val lo = Math.floorDiv(vals.min() - 6, 10) * 10
    val hi = Math.floorDiv(vals.max() + 6 + 9, 10) * 10
    fun y(v: Int) = pb - (v - lo).toFloat() / (hi - lo) * (pb - pt)
    val t0 = start.atStartOfDay(Z.zone).toInstant().toEpochMilli()
    val span = days * 86_400_000f
    fun x(ts: Long) = left + (ts - t0) / span * (right - left)

    // grid: a fine line every 5, a stronger line with its number every 10
    val fine = Paint().apply { color = 0xFFECF0F5.toInt(); strokeWidth = 0.5f }
    val major = Paint().apply { color = 0xFFDCE3EC.toInt(); strokeWidth = 0.7f }
    val axis = pdfPaint(7f, P_MUTED, align = Paint.Align.RIGHT)
    var v = lo
    while (v <= hi) {
        c.drawLine(left, y(v), right, y(v), if (v % 10 == 0) major else fine)
        if (v % 10 == 0) c.drawText("$v", left - 4f, y(v) + 2.6f, axis)
        v += 5
    }
    // days: a thin line for each, the day number where it fits, the month at the start and when it changes
    val slot = (right - left) / days
    val every = maxOf(1, ceil(12f / slot).toInt())
    val dayP = pdfPaint(6.8f, P_MUTED, align = Paint.Align.CENTER)
    val dayLine = Paint().apply { color = 0xFFEEF2F6.toInt(); strokeWidth = 0.5f }
    for (d in 0..days) {
        val xx = left + d * slot
        c.drawLine(xx, pt, xx, pb, dayLine)
        if (d < days) {
            val day = start.plusDays(d.toLong())
            if (d % every == 0) c.drawText("${day.dayOfMonth}", xx + slot / 2f, pb + 9f, dayP)
        }
    }

    // lines and dots (the first line drawn last, so it stays on top)
    class Pt(val x: Float, val y: Float, val v: Int, val line: Line)
    val all = lines.map { l -> list.mapNotNull { r -> l.value(r)?.let { Pt(x(r.takenAt), y(it), it, l) } } }
    for (pts in all.reversed()) {
        if (pts.isEmpty()) continue
        val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = pts[0].line.color; alpha = 217; strokeWidth = 1.1f; style = Paint.Style.STROKE; strokeJoin = Paint.Join.ROUND
        }
        if (pts.size > 1) c.drawPath(Path().apply { moveTo(pts[0].x, pts[0].y); pts.drop(1).forEach { lineTo(it.x, it.y) } }, stroke)
        pts.forEach { dot(c, it.x, it.y, it.line.color) }
    }

    // the numbers: above the dot (below for DIA), or on the other side if that is taken; skipped where nothing is free
    val fs = 6.2f
    val lab = pdfPaint(fs, bold = true, align = Paint.Align.CENTER)
    val taken = all.flatten().map { RectF(it.x - 2.6f, it.y - 2.6f, it.x + 2.6f, it.y + 2.6f) }.toMutableList()
    val order = all.flatMap { pts ->
        val mx = pts.maxOfOrNull { it.v }; val mn = pts.minOfOrNull { it.v }
        pts.map { it to (if (it.v == mx || it.v == mn) 0 else 1) }
    }.sortedBy { it.second }.map { it.first }
    for (p in order) {
        val s = "${p.v}"
        val half = lab.measureText(s) / 2f + 0.8f
        val prefUp = p.line.name != t(R.string.legend_dia)
        for (up in listOf(prefUp, !prefUp)) {
            val by = if (up) p.y - 3.8f else p.y + 8.6f
            val r = RectF(p.x - half, by - fs * 0.78f, p.x + half, by + 0.8f)
            if (r.top < pt - 2f || r.bottom > pb + 1f || taken.any { RectF.intersects(it, r) }) continue
            taken.add(r)
            lab.color = p.line.textColor
            c.drawText(s, p.x, by, lab)
            break
        }
    }
}

/**
 * The balance, as in the web report (report.js): morning on the left, evening on the right, each pan with its average
 * SYS/DIA over the period. The side with the higher average goes up (like a higher point in the charts) (average of the SYS and DIA differences, at most
 * 10 degrees); within 1 mmHg the beam stays level. Only arithmetic, in neutral colours: nothing is good or bad.
 */
private fun pdfBalance(c: Canvas, x: Float, y: Float, w: Float, h: Float, list: List<Reading>) {
    class Side(val n: Int, val sys: Int, val dia: Int)
    fun side(per: String): Side? {
        val l = list.filter { it.period == per }
        return if (l.isEmpty()) null else Side(l.size, l.map { it.sis }.average().roundToInt(), l.map { it.dia }.average().roundToInt())
    }
    val beamCol = 0xFF8A97B0.toInt()
    c.drawText(t(R.string.bal_title), x, y + 12f, pdfPaint(11.5f, bold = true))
    c.drawText(t(R.string.bal_sub), x + w, y + 12f, pdfPaint(7.5f, P_MUTED, align = Paint.Align.RIGHT))
    val m = side("morning"); val e = side("evening")
    if (m == null || e == null) {
        c.drawText(t(R.string.bal_none), x + w / 2f, y + h / 2f + 8f, pdfPaint(9f, P_MUTED, align = Paint.Align.CENTER)); return
    }
    val ds = e.sys - m.sys; val dd = e.dia - m.dia
    val level = kotlin.math.abs(ds) < 1 && kotlin.math.abs(dd) < 1
    val deg = if (level) 0f else -((ds + dd) / 2f * 1.2f).coerceIn(-10f, 10f)   // higher average = higher pan, as in the charts
    val a = Math.toRadians(deg.toDouble())
    val cx = x + w / 2f; val py = y + h * 0.56f; val half = minOf(w * 0.3f, 170f)
    val lx = cx - half * kotlin.math.cos(a).toFloat(); val ly = py - half * kotlin.math.sin(a).toFloat()
    val rx = cx + half * kotlin.math.cos(a).toFloat(); val ry = py + half * kotlin.math.sin(a).toFloat()
    val soft = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = beamCol; alpha = 140 }
    c.drawPath(Path().apply { moveTo(cx - 16f, y + h - 18f); lineTo(cx + 16f, y + h - 18f); lineTo(cx, py + 4f); close() }, soft)
    c.drawRoundRect(RectF(cx - 34f, y + h - 18f, cx + 34f, y + h - 15f), 1.5f, 1.5f, soft)
    c.drawLine(lx, ly, rx, ry, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = beamCol; strokeWidth = 3f; strokeCap = Paint.Cap.ROUND })
    c.drawCircle(cx, py, 4f, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = P_INK })
    val thin = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = beamCol; strokeWidth = 1f; style = Paint.Style.STROKE }
    val pan = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFEEF2F7.toInt() }
    for ((px, pyy, label, v) in listOf(Quad(lx, ly, t(R.string.pdf_morning_t), m), Quad(rx, ry, t(R.string.pdf_evening_t), e))) {
        c.drawLine(px, pyy, px - 22f, pyy + 16f, thin); c.drawLine(px, pyy, px + 22f, pyy + 16f, thin)
        val bowl = Path().apply { moveTo(px - 30f, pyy + 16f); quadTo(px, pyy + 30f, px + 30f, pyy + 16f); close() }
        c.drawPath(bowl, pan); c.drawPath(bowl, thin)
        c.drawText("$label · ${t(R.string.n_readings, v.n)}", px, pyy - 30f, pdfPaint(7.5f, P_MUTED, align = Paint.Align.CENTER))
        val big = pdfPaint(15f, bold = true)
        val sw = big.measureText("${v.sys}"); val slash = pdfPaint(15f).measureText("/"); val dw = big.measureText("${v.dia}")
        val x0 = px - (sw + slash + dw) / 2f
        c.drawText("${v.sys}", x0, pyy - 11f, pdfPaint(15f, P_SYS_T, true))
        c.drawText("/", x0 + sw, pyy - 11f, pdfPaint(15f, P_MUTED))
        c.drawText("${v.dia}", x0 + sw + slash, pyy - 11f, pdfPaint(15f, P_DIA_T, true))
    }
    fun sgn(v: Int) = if (v > 0) "+$v" else "$v"
    c.drawText(if (level) t(R.string.bal_same) else t(R.string.bal_diff, sgn(ds), sgn(dd)), x + w / 2f, y + h - 2f, pdfPaint(8f, align = Paint.Align.CENTER))
}

private data class Quad<A, B, C, D>(val a: A, val b: B, val c: C, val d: D)

/** One point per day: the average of that day's readings, placed at midday so it sits in the middle of its day. */
private fun dailyMeans(list: List<Reading>): List<Reading> =
    list.groupBy { Z.date(it.takenAt) }.toSortedMap().map { (d, l) ->
        val pul = l.mapNotNull { it.pul }
        Reading(
            "", d.atStartOfDay(Z.zone).plusHours(12).toInstant().toEpochMilli(), l[0].period,
            l.map { it.sis }.average().roundToInt(), l.map { it.dia }.average().roundToInt(),
            if (pul.isEmpty()) null else pul.average().roundToInt(), "avg"
        )
    }

/** A reading's dot: filled with the line colour, with a white ring so it stands out on the lines. */
private fun dot(c: Canvas, x: Float, y: Float, color: Int) {
    c.drawCircle(x, y, 2.3f, Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color })
    c.drawCircle(x, y, 2.3f, Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = 0xFFFFFFFF.toInt(); style = Paint.Style.STROKE; strokeWidth = 0.8f })
}

/**
 * The report for the doctor, A4. Page 1: header, the chart of every reading, then nine boxes (highest, lowest,
 * average of SYS, DIA and PUL, with day and time). Page 2: the same chart for the morning and for the evening.
 * Page 3: pulse alone. Then every reading, grouped by day. No judgement on the values: that is the doctor's.
 */
fun buildPdf(ctx: Context, all: List<Reading>, n: Int): File {
    val per = periodInfo(all, n)
    val list = per.list.sortedBy { it.takenAt }
    val doc = PdfDocument()
    val W = 595f
    val left = 40f
    val right = 555f
    val cw = right - left
    val rule = Paint().apply { color = P_RULE; strokeWidth = 0.8f }
    val note = pdfPaint(6.5f, P_MUTED)
    val body = pdfPaint(9.5f)
    val bodyB = pdfPaint(9.5f, bold = true)

    val sysL = Line(t(R.string.legend_sys), P_SYS, P_SYS_T) { it.sis }
    val diaL = Line(t(R.string.legend_dia), P_DIA, P_DIA_T) { it.dia }
    val pulL = Line(t(R.string.label_pul), P_PUL, P_PUL_T) { it.pul }
    val three = listOf(sysL, diaL, pulL)
    val bpOnly = listOf(sysL, diaL)   // blood pressure charts: the pulse has its own chart

    val rowsPerPage = 40
    val totalPages = 3 + maxOf(1, (list.size + rowsPerPage - 1) / rowsPerPage)
    var pageNo = 0
    val pages = mutableListOf<PdfDocument.Page>()
    fun newPage(): Canvas {
        val page = doc.startPage(PdfDocument.PageInfo.Builder(595, 842, ++pageNo).create())
        pages.add(page)
        return page.canvas
    }
    val range = t(R.string.pdf_range, Z.short(per.start), Z.long(per.end), n)

    fun footer(c: Canvas) {
        c.drawLine(left, 806f, right, 806f, rule)
        c.drawText(t(R.string.pdf_source_note), left, 818f, note)
        c.drawText(t(R.string.pdf_disclaimer), left, 829f, note)
        c.drawText(t(R.string.pdf_page, pageNo, totalPages), right, 829f, pdfPaint(7f, P_MUTED, align = Paint.Align.RIGHT))
    }
    // pages after the first: a slim band with the title and the period
    fun smallHeader(c: Canvas) {
        c.drawRect(0f, 0f, W, 40f, Paint().apply { color = 0xFF0F1C36.toInt() })
        c.drawRect(0f, 40f, W, 42f, Paint().apply { color = P_SYS })
        c.drawText(t(R.string.pdf_title), left, 25f, pdfPaint(10f, 0xFFFFFFFF.toInt(), true))
        c.drawText(range, right, 25f, pdfPaint(8f, 0xFFAFC0DC.toInt(), align = Paint.Align.RIGHT))
    }

    // ---------- page 1: header, the whole period, the nine boxes ----------
    var c = newPage()
    c.drawRect(0f, 0f, W, 112f, Paint().apply {
        shader = android.graphics.LinearGradient(0f, 0f, W, 112f, 0xFF0F1C36.toInt(), 0xFF1F3D72.toInt(), android.graphics.Shader.TileMode.CLAMP)
    })
    // a faint heartbeat trace across the band
    c.drawPath(Path().apply {
        moveTo(300f, 70f); lineTo(400f, 70f); rLineTo(6f, -8f); rLineTo(6f, 8f); rLineTo(8f, 0f); rLineTo(5f, -26f)
        rLineTo(6f, 44f); rLineTo(5f, -18f); rLineTo(14f, 0f); rLineTo(6f, -6f); rLineTo(6f, 6f); lineTo(W, 70f)
    }, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0x1AFFFFFF; style = Paint.Style.STROKE; strokeWidth = 1.6f })
    c.drawRect(0f, 112f, W, 115f, Paint().apply { color = P_SYS })
    c.drawText("HINT 365 · HEALTHYINSTANTTRACKER", left, 30f, pdfPaint(8f, 0xFFAFC0DC.toInt(), true, spacing = 0.2f))
    c.drawText(t(R.string.pdf_generated, Z.dmy(Z.today())), right, 30f, pdfPaint(8f, 0xFFAFC0DC.toInt(), align = Paint.Align.RIGHT))
    c.drawText(t(R.string.pdf_title), left, 62f, pdfPaint(24f, 0xFFFFFFFF.toInt(), true))
    c.drawText(range, left, 82f, pdfPaint(10.5f, 0xFFDCE5F3.toInt()))
    c.drawText(t(R.string.pdf_count, list.size, list.map { Z.date(it.takenAt) }.toSet().size), left, 98f, pdfPaint(8f, 0xFFAFC0DC.toInt()))

    // the charts show one dot per day, the day's average: said once here, above the first chart
    c.drawText(t(R.string.pdf_note), left, 130f, pdfPaint(7.5f, P_MUTED))
    pdfChart(c, left, 146f, cw, 300f, dailyMeans(list), bpOnly, t(R.string.pdf_chart_all), t(R.string.pdf_chart_all_sub), t(R.string.pdf_units), per.start, n)

    // nine boxes: for SYS, DIA and PUL the highest and the lowest (with day and time) and the average
    var y = 486f
    c.drawText(t(R.string.pdf_values), left, y, pdfPaint(11.5f, bold = true))
    c.drawText(t(R.string.pdf_values_sub), right, y, pdfPaint(8f, P_MUTED, align = Paint.Align.RIGHT))
    y += 10f
    val gap = 10f
    val bw = (cw - 2 * gap) / 3f
    val bh = 58f
    val panel = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = P_PANEL }
    fun whenOf(r: Reading) = "${Z.dmy(Z.date(r.takenAt))} · ${Z.time(r.takenAt)}"
    for (row in 0..2) {
        three.forEachIndexed { i, l ->
            val x = left + i * (bw + gap)
            val withV = list.filter { l.value(it) != null }
            val label: String
            val value: String
            val sub: String
            when (row) {
                0, 1 -> {
                    val r = if (row == 0) withV.maxByOrNull { l.value(it)!! } else withV.minByOrNull { l.value(it)!! }
                    label = t(if (row == 0) R.string.pdf_hi else R.string.pdf_lo, l.name)
                    value = r?.let { "${l.value(it)}" } ?: "–"
                    sub = r?.let { whenOf(it) + if (l === pulL) "" else "  ·  ${it.sis}/${it.dia}" } ?: ""
                }
                else -> {
                    label = t(R.string.pdf_avg, l.name)
                    value = if (withV.isEmpty()) "–" else "${withV.map { l.value(it)!! }.average().roundToInt()}"
                    sub = t(R.string.pdf_avg_of, withV.size)
                }
            }
            c.drawRoundRect(RectF(x, y, x + bw, y + bh), 4f, 4f, panel)
            c.drawRect(x, y, x + 3f, y + bh, Paint().apply { color = l.color })
            c.drawText(label.uppercase(), x + 12f, y + 15f, pdfPaint(7.5f, P_MUTED, true, spacing = 0.05f))
            val big = pdfPaint(20f, bold = true)
            c.drawText(value, x + 12f, y + 38f, big)
            c.drawText(if (l === pulL) "bpm" else "mmHg", x + 12f + big.measureText(value) + 4f, y + 38f, pdfPaint(7.5f, P_MUTED))
            c.drawText(sub, x + 12f, y + 50f, pdfPaint(7.2f, P_MUTED))
        }
        y += bh + gap
    }
    footer(c)
    doc.finishPage(pages.last())

    // ---------- page 2: morning and evening ----------
    c = newPage()
    smallHeader(c)
    pdfChart(c, left, 74f, cw, 280f, dailyMeans(list.filter { it.period == "morning" }), bpOnly, t(R.string.pdf_morning_t), t(R.string.pdf_morning_sub), t(R.string.pdf_units), per.start, n)
    pdfChart(c, left, 384f, cw, 280f, dailyMeans(list.filter { it.period == "evening" }), bpOnly, t(R.string.pdf_evening_t), t(R.string.pdf_evening_sub), t(R.string.pdf_units), per.start, n)
    pdfBalance(c, left, 680f, cw, 118f, list)
    footer(c)
    doc.finishPage(pages.last())

    // ---------- page 3: pulse alone ----------
    c = newPage()
    smallHeader(c)
    pdfChart(c, left, 74f, cw, 330f, dailyMeans(list), listOf(pulL), t(R.string.pdf_pulse_t), t(R.string.pdf_pulse_sub), t(R.string.pdf_units_pul), per.start, n)
    footer(c)
    doc.finishPage(pages.last())

    // ---------- every reading ----------
    val cols = floatArrayOf(left, 110f, 160f, 265f, 335f, 405f, 470f)
    val heads = listOf(t(R.string.col_date), t(R.string.col_time), t(R.string.col_period), t(R.string.legend_sys), t(R.string.legend_dia), t(R.string.label_pul), t(R.string.col_source))
    val head = pdfPaint(9f, 0xFFFFFFFF.toInt(), true)
    val band = Paint().apply { color = 0xFFF6F8FB.toInt() }
    val dayRule = Paint().apply { color = 0xFF9FB0C8.toInt(); strokeWidth = 0.8f }
    val cellCol = listOf(P_INK, P_INK, P_INK, P_SYS_T, P_DIA_T, P_PUL_T, P_INK)
    var i = 0
    do {
        c = newPage()
        smallHeader(c)
        c.drawText(t(R.string.pdf_all), left, 74f, pdfPaint(11.5f, bold = true))
        y = 84f
        c.drawRect(left, y, right, y + 18f, Paint().apply { color = 0xFF0F1C36.toInt() })
        heads.forEachIndexed { k, h -> c.drawText(h, cols[k] + 5f, y + 12.5f, head) }
        y += 18f
        var row = 0
        var lastDay: LocalDate? = null
        if (list.isEmpty()) c.drawText(t(R.string.report_empty), left, y + 16f, body)
        while (i < list.size && row < rowsPerPage) {
            val r = list[i]
            val day = Z.date(r.takenAt)
            if (row % 2 == 1) c.drawRect(left, y, right, y + 17f, band)
            if (lastDay != null && day != lastDay) c.drawLine(left, y, right, y, dayRule)   // a new day starts
            val cells = listOf(
                if (day != lastDay) Z.dmy(day) else "", Z.time(r.takenAt), ampm(r.period),
                r.sis.toString(), r.dia.toString(), r.pul?.toString() ?: "–", sourceLabel(r.source)
            )
            cells.forEachIndexed { k, v -> c.drawText(v, cols[k] + 5f, y + 12f, (if (k in 3..5) bodyB else body).apply { color = cellCol[k] }) }
            lastDay = day
            y += 17f; i++; row++
        }
        footer(c)
        doc.finishPage(pages.last())
    } while (i < list.size)

    val dir = File(ctx.cacheDir, "reports").apply { mkdirs() }
    val file = File(dir, "blood-pressure_${n}d_${per.end}.pdf")
    FileOutputStream(file).use { doc.writeTo(it) }
    doc.close()
    return file
}

/* ---------------- CSV for Excel ---------------- */

fun buildCsv(ctx: Context, all: List<Reading>, n: Int): File {
    val per = periodInfo(all, n)
    val sb = StringBuilder("\uFEFF")
    sb.append(listOf(t(R.string.col_date), t(R.string.col_time), t(R.string.col_period), t(R.string.legend_sys) + " (mmHg)", t(R.string.legend_dia) + " (mmHg)", t(R.string.label_pul), t(R.string.col_source)).joinToString(";"))
    sb.append("\r\n")
    per.list.forEach { r ->
        sb.append(listOf(Z.dmy(Z.date(r.takenAt)), Z.time(r.takenAt), ampm(r.period), r.sis, r.dia, r.pul ?: "", sourceLabel(r.source)).joinToString(";"))
        sb.append("\r\n")
    }
    val dir = File(ctx.cacheDir, "reports").apply { mkdirs() }
    val file = File(dir, "blood-pressure_${n}d_${per.end}.csv")
    file.writeText(sb.toString(), Charsets.UTF_8)
    return file
}

/**
 * The PDF goes to the phone's Downloads folder and opens in the PDF viewer. Android 10 and later need no permission
 * for that; on older phones it is handed to the share window instead, where it can be saved or sent.
 */
fun downloadPdf(ctx: Context, file: File) {
    if (android.os.Build.VERSION.SDK_INT < 29) { shareFile(ctx, file, "application/pdf"); return }
    val values = android.content.ContentValues().apply {
        put(android.provider.MediaStore.MediaColumns.DISPLAY_NAME, file.name)
        put(android.provider.MediaStore.MediaColumns.MIME_TYPE, "application/pdf")
        put(android.provider.MediaStore.MediaColumns.RELATIVE_PATH, android.os.Environment.DIRECTORY_DOWNLOADS)
    }
    val resolver = ctx.contentResolver
    val uri = resolver.insert(android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI, values) ?: error("download_failed")
    resolver.openOutputStream(uri)?.use { out -> file.inputStream().use { it.copyTo(out) } } ?: error("download_failed")
    android.widget.Toast.makeText(ctx, t(R.string.pdf_saved), android.widget.Toast.LENGTH_LONG).show()
    try {
        ctx.startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/pdf").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION))
    } catch (_: android.content.ActivityNotFoundException) { }   // no PDF viewer: the file is in Downloads anyway
}

/**
 * Opens an address in a web browser, never in another app that claims the link (a download manager, for example,
 * would save the page instead of showing it).
 */
/**
 * Opens a web address in the phone's browser, never in another app that registered for links of this site (that
 * downloaded a file instead, P-005). The browser is chosen by asking which apps open any web address: the
 * phone's default one when it is a browser, otherwise Chrome or the first browser found. The address itself is
 * always passed to the browser (in 0.1.111 a "browser selector" opened the browser's start page without it, P-006).
 */
fun openInBrowser(ctx: Context, url: String) {
    val view = Intent(Intent.ACTION_VIEW, android.net.Uri.parse(url)).addCategory(Intent.CATEGORY_BROWSABLE)
    if (ctx !is android.app.Activity) view.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    val pkg = try {
        val pm = ctx.packageManager
        val anyPage = Intent(Intent.ACTION_VIEW, android.net.Uri.parse("https://example.com/")).addCategory(Intent.CATEGORY_BROWSABLE)
        val browsers = pm.queryIntentActivities(anyPage, 0).map { it.activityInfo.packageName }.distinct()
        val def = pm.resolveActivity(anyPage, android.content.pm.PackageManager.MATCH_DEFAULT_ONLY)?.activityInfo?.packageName
        def?.takeIf { it in browsers } ?: browsers.firstOrNull { it == "com.android.chrome" } ?: browsers.firstOrNull()
    } catch (e: Exception) { ErrorReport.report("Web/browser", e); null }
    if (pkg != null) {
        try { ctx.startActivity(Intent(view).setPackage(pkg)); return }
        catch (e: android.content.ActivityNotFoundException) { ErrorReport.report("Web/browser", e) }
    }
    try { ctx.startActivity(view) }
    catch (e: android.content.ActivityNotFoundException) { ErrorReport.send("no_browser", "Web/browser", ""); throw e }
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
