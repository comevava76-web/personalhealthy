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

/**
 * The report for the doctor, A4. Page 1: header, key figures, averages by moment of the day, extreme values
 * with their date, the daily chart. Next pages: every reading, grouped by day. Every page says where the values
 * come from and carries its number. No judgement on the values: that is the doctor's.
 */
fun buildPdf(ctx: Context, all: List<Reading>, n: Int): File {
    val per = periodInfo(all, n)
    val st = stats(per.list)
    val list = per.list
    val doc = PdfDocument()
    val W = 595f
    val left = 40f
    val right = 555f
    val ink = 0xFF13223F.toInt()
    val muted = 0xFF5B6B88.toInt()
    val lineCol = 0xFFD9E0EA.toInt()

    fun paint(size: Float, color: Int = ink, bold: Boolean = false, align: Paint.Align = Paint.Align.LEFT) =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            textSize = size; this.color = color; textAlign = align
            typeface = Typeface.create(Typeface.DEFAULT, if (bold) Typeface.BOLD else Typeface.NORMAL)
        }
    val h2 = paint(12f, ink, true)
    val body = paint(9.5f, ink)
    val bodyB = paint(9.5f, ink, true)
    val note = paint(8f, muted)
    val rule = Paint().apply { color = lineCol; strokeWidth = 0.8f }
    val boxBg = Paint().apply { color = 0xFFF3F6FA.toInt() }

    // pages: 1 summary + the readings table, 36 rows per page (a day separator takes no extra row)
    val rowsPerPage = 36
    val totalPages = 1 + maxOf(1, (list.size + rowsPerPage - 1) / rowsPerPage)
    var pageNo = 0
    val pages = mutableListOf<PdfDocument.Page>()

    fun newPage(): Canvas {
        val page = doc.startPage(PdfDocument.PageInfo.Builder(595, 842, ++pageNo).create())
        pages.add(page)
        return page.canvas
    }

    fun header(c: Canvas, subtitle: String) {
        c.drawRect(0f, 0f, W, 74f, Paint().apply { color = ink })
        c.drawRect(0f, 74f, W, 77f, Paint().apply { color = SYS_COLOR })
        c.drawText("HINT · HealthyInstantTracker", left, 26f, paint(8.5f, 0xFFB9C6DD.toInt(), true))
        c.drawText(t(R.string.pdf_title), left, 50f, paint(19f, 0xFFFFFFFF.toInt(), true))
        c.drawText(subtitle, left, 66f, paint(9.5f, 0xFFD6DEEC.toInt()))
        c.drawText(t(R.string.pdf_generated, Z.dmy(Z.today())), right, 26f, paint(8.5f, 0xFFB9C6DD.toInt(), align = Paint.Align.RIGHT))
    }

    fun footer(c: Canvas) {
        c.drawLine(left, 800f, right, 800f, rule)
        c.drawText(t(R.string.pdf_source_note), left, 812f, note)
        c.drawText(t(R.string.pdf_disclaimer), left, 824f, note)
        c.drawText(t(R.string.pdf_page, pageNo, totalPages), right, 824f, paint(8f, muted, align = Paint.Align.RIGHT))
    }

    fun section(c: Canvas, title: String, y: Float) {
        c.drawText(title, left, y, h2)
        c.drawLine(left, y + 5f, right, y + 5f, rule)
    }

    val subtitle = t(R.string.pdf_period, n, Z.long(per.start), Z.long(per.end))

    // ---------- page 1 ----------
    var c = newPage()
    header(c, subtitle)
    var y = 104f

    // key figures: three boxes
    section(c, t(R.string.pdf_summary), y); y += 16f
    val boxW = (right - left - 20f) / 3f
    val puls = list.mapNotNull { it.pul }
    val keys = listOf(
        Triple(t(R.string.period_avg), if (st.n > 0) "${st.sis}/${st.dia}" else "–", "mmHg"),
        Triple(t(R.string.avg_pulse), st.pul?.toString() ?: "–", t(R.string.per_minute)),
        Triple(t(R.string.pdf_measures), "${st.n}", t(R.string.pdf_in_days, st.days, n))
    )
    keys.forEachIndexed { k, (lab, v, unit) ->
        val x = left + k * (boxW + 10f)
        c.drawRoundRect(RectF(x, y, x + boxW, y + 58f), 6f, 6f, boxBg)
        c.drawText(lab, x + 10f, y + 16f, note)
        c.drawText(v, x + 10f, y + 40f, paint(18f, ink, true))
        c.drawText(unit, x + 10f, y + 52f, note)
    }
    y += 80f

    // averages by moment of the day
    section(c, t(R.string.pdf_by_moment), y); y += 20f
    val mc = floatArrayOf(left, 215f, 330f, 430f)
    listOf(t(R.string.pdf_col_moment), t(R.string.pdf_col_avg), t(R.string.label_pul), t(R.string.pdf_measures))
        .forEachIndexed { k, h -> c.drawText(h, mc[k], y, note) }
    y += 14f
    for ((key, label) in listOf("morning" to t(R.string.pdf_morning), "afternoon" to t(R.string.pdf_afternoon), "evening" to t(R.string.pdf_evening))) {
        val l = list.filter { it.period == key }
        fun avg(v: List<Int>) = if (v.isEmpty()) "–" else v.average().roundToInt().toString()
        c.drawText(label, mc[0], y, body)
        c.drawText(if (l.isEmpty()) "–" else "${avg(l.map { it.sis })}/${avg(l.map { it.dia })} mmHg", mc[1], y, bodyB)
        c.drawText(avg(l.mapNotNull { it.pul }), mc[2], y, body)
        c.drawText("${l.size}", mc[3], y, body)
        y += 6f; c.drawLine(left, y, right, y, rule); y += 12f
    }
    y += 10f

    // extreme values, each with its date
    section(c, t(R.string.pdf_extremes), y); y += 20f
    fun whenOf(r: Reading) = t(R.string.when_fmt, Z.dmy(Z.date(r.takenAt)), Z.time(r.takenAt)) + ", " + periodLabel(r.period).lowercase()
    val ext = listOf(
        Triple(t(R.string.peak_sys), st.maxS?.let { "${it.sis}/${it.dia} mmHg" }, st.maxS?.let { whenOf(it) }),
        Triple(t(R.string.max_dia), st.maxD?.let { "${it.sis}/${it.dia} mmHg" }, st.maxD?.let { whenOf(it) }),
        Triple(t(R.string.lowest), st.minS?.let { "${it.sis}/${it.dia} mmHg" }, st.minS?.let { whenOf(it) }),
        Triple(t(R.string.pulse_range), if (puls.isEmpty()) null else "${puls.min()} – ${puls.max()} ${t(R.string.per_minute)}", null)
    )
    ext.forEach { (lab, v, w) ->
        c.drawText(lab, mc[0], y, body)
        c.drawText(v ?: "–", mc[1], y, bodyB)
        if (w != null) c.drawText(w, mc[2], y, note)
        y += 6f; c.drawLine(left, y, right, y, rule); y += 12f
    }
    y += 10f

    // daily chart
    section(c, t(R.string.pdf_chart), y); y += 12f
    val chartH = minOf(290f, 770f - y)
    c.save()
    c.translate(left, y)
    drawBpChart(c, right - left, chartH, list, per.start, n, PRINT_PAL, 8.5f)
    c.restore()
    drawChartLegend(c, left, y + chartH + 14f, PRINT_PAL, 8.5f)
    footer(c)
    doc.finishPage(pages.last())

    // ---------- readings table ----------
    val cols = floatArrayOf(left, 110f, 160f, 265f, 335f, 405f, 470f)
    val heads = listOf(t(R.string.col_date), t(R.string.col_time), t(R.string.col_period), t(R.string.legend_sys), t(R.string.legend_dia), t(R.string.label_pul), t(R.string.col_source))
    val head = paint(9f, 0xFFFFFFFF.toInt(), true)
    val band = Paint().apply { color = 0xFFF6F8FB.toInt() }
    val dayRule = Paint().apply { color = 0xFF9FB0C8.toInt(); strokeWidth = 0.8f }
    var i = 0
    do {
        c = newPage()
        header(c, subtitle)
        section(c, t(R.string.pdf_all), 104f)
        y = 118f
        c.drawRect(left, y, right, y + 18f, Paint().apply { color = ink })
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
                if (day != lastDay) Z.dmy(day) else "", Z.time(r.takenAt), periodLabel(r.period),
                r.sis.toString(), r.dia.toString(), r.pul?.toString() ?: "–", sourceLabel(r.source)
            )
            cells.forEachIndexed { k, v -> c.drawText(v, cols[k] + 5f, y + 12f, if (k in 3..4) bodyB else body) }
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
        sb.append(listOf(Z.dmy(Z.date(r.takenAt)), Z.time(r.takenAt), periodLabel(r.period), r.sis, r.dia, r.pul ?: "", sourceLabel(r.source)).joinToString(";"))
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
