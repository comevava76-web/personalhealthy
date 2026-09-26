package ch.personalhealthy.app

import android.content.Context
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

// Line colours, the same in the app and in the PDF
val SYS_COLOR = 0xFFF2545B.toInt()    // systolic, coral
val DIA_COLOR = 0xFF3FA7D6.toInt()    // diastolic, teal-blue
val PUL_COLOR = 0xFFFFC145.toInt()    // pulse, amber

val SCREEN_PAL = ChartPal(bg = 0xFF172B50.toInt(), grid = 0x14EAF0FA, text = 0xFF9AAACA.toInt(), outline = 0)
val PRINT_PAL = ChartPal(
    bg = 0xFFFFFFFF.toInt(), grid = 0xFFE6EBF2.toInt(), text = 0xFF5B6B88.toInt(),
    outline = 0x66000000 // thin dark ring so the light dots stay visible on white
)

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
 * Points are daily averages; smooth lines for systolic, diastolic and pulse on one "mmHg / bpm" axis.
 * Plain background, no reference lines and no coloured zones: the app does not judge the values.
 * Only the day number under each day.
 */
fun drawBpChart(c: Canvas, w: Float, h: Float, list: List<Reading>, start: LocalDate, days: Int, pal: ChartPal, fs: Float) {
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
    val vals = pts.flatMap { listOfNotNull(it.sis, it.dia, it.pul) }
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
    val step = if (hi - lo > 120) 30 else 20
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
    fun series(values: List<Pair<Float, Float>>, col: Int) {
        if (values.isEmpty()) return
        val lp = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = col; strokeWidth = fs * 0.16f; style = Paint.Style.STROKE
            strokeJoin = Paint.Join.ROUND; strokeCap = Paint.Cap.ROUND
        }
        if (values.size > 1) c.drawPath(monotonePath(values), lp)
        val dot = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = col }
        val ring = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = pal.outline; style = Paint.Style.STROKE; strokeWidth = fs * 0.06f }
        values.forEach { (px, py) ->
            c.drawCircle(px, py, fs * 0.3f, dot)
            if (pal.outline != 0) c.drawCircle(px, py, fs * 0.3f, ring)
        }
    }
    series(pul, PUL_COLOR)
    series(dia, DIA_COLOR)
    series(sys, SYS_COLOR)
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

/** Colour legend for the PDF: systolic, diastolic, pulse. */
fun drawChartLegend(c: Canvas, x: Float, y: Float, pal: ChartPal, fs: Float) {
    val text = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = pal.text; textSize = fs }
    val sw = Paint(Paint.ANTI_ALIAS_FLAG)
    var cx = x
    for ((label, col) in listOf(t(R.string.legend_sys) to SYS_COLOR, t(R.string.legend_dia) to DIA_COLOR, t(R.string.label_pul) to PUL_COLOR)) {
        sw.color = col
        c.drawRoundRect(RectF(cx, y - fs * 0.8f, cx + fs * 0.8f, y), fs * 0.2f, fs * 0.2f, sw)
        c.drawText(label, cx + fs * 1.2f, y, text)
        cx += fs * 1.2f + text.measureText(label) + fs * 1.6f
    }
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

    // page 1: summary and chart
    var page = doc.startPage(PdfDocument.PageInfo.Builder(595, 842, pageNo++).create())
    var c = page.canvas
    c.drawText(t(R.string.pdf_title), left, 60f, title)
    c.drawText(t(R.string.pdf_period, n, Z.long(per.start), Z.long(per.end)), left, 80f, sub)
    c.drawText(t(R.string.pdf_counts, st.n, st.days), left, 96f, sub)

    c.save()
    c.translate(left, 112f)
    drawBpChart(c, right - left, 250f, per.list, per.start, n, PRINT_PAL, 9f)
    c.restore()
    drawChartLegend(c, left, 380f, PRINT_PAL, 9f)
    c.drawText(t(R.string.chart_daily), left, 396f, small)

    fun f(r: Reading?) = if (r == null) "-" else "${r.sis}/${r.dia}  (${t(R.string.when_fmt, Z.dmy(Z.date(r.takenAt)), Z.time(r.takenAt))})"
    val rows = listOf(
        t(R.string.period_avg) to "${st.sis ?: "-"}/${st.dia ?: "-"} mmHg",
        t(R.string.avg_morning) to (if (st.mN > 0) "${st.mS}/${st.mD} mmHg  (${t(R.string.readings_short, st.mN)})" else "-"),
        t(R.string.avg_evening) to (if (st.eN > 0) "${st.eS}/${st.eD} mmHg  (${t(R.string.readings_short, st.eN)})" else "-"),
        t(R.string.avg_pulse) to (st.pul?.let { t(R.string.per_min_short, it) } ?: "-"),
        t(R.string.peak_sys) to f(st.maxS),
        t(R.string.max_dia) to f(st.maxD),
        t(R.string.lowest) to f(st.minS)
    )
    var yy = 425f
    rows.forEach { (k, v) ->
        c.drawText(k, left, yy, label)
        c.drawText(v, 210f, yy, value)
        yy += 20f
    }
    footer(c)
    doc.finishPage(page)

    // following pages: table of all readings
    val cols = floatArrayOf(left, 120f, 170f, 250f, 330f, 410f)
    val heads = listOf(t(R.string.col_date), t(R.string.col_time), t(R.string.col_period), t(R.string.legend_sys), t(R.string.legend_dia), t(R.string.label_pul))
    val head = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFFFFFFF.toInt(); textSize = 10f; typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD) }
    val cell = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFF13223F.toInt(); textSize = 10f }
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
            val cells = listOf(Z.dmy(Z.date(r.takenAt)), Z.time(r.takenAt), periodLabel(r.period), r.sis.toString(), r.dia.toString(), r.pul?.toString() ?: "-")
            cells.forEachIndexed { k, s -> c.drawText(s, cols[k] + 4f, y + 13f, cell) }
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

/* ---------------- CSV for Excel ---------------- */

fun buildCsv(ctx: Context, all: List<Reading>, n: Int): File {
    val per = periodInfo(all, n)
    val sb = StringBuilder("\uFEFF")
    sb.append(listOf(t(R.string.col_date), t(R.string.col_time), t(R.string.col_period), t(R.string.legend_sys) + " (mmHg)", t(R.string.legend_dia) + " (mmHg)", t(R.string.label_pul)).joinToString(";"))
    sb.append("\r\n")
    per.list.forEach { r ->
        sb.append(listOf(Z.dmy(Z.date(r.takenAt)), Z.time(r.takenAt), periodLabel(r.period), r.sis, r.dia, r.pul ?: "").joinToString(";"))
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
