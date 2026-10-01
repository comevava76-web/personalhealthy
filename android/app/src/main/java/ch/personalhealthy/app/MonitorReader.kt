package ch.personalhealthy.app

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sqrt

/*
 * Reads SYS, DIA and PUL from a photo of a blood-pressure monitor's display, on the phone, without any AI service:
 * the digits of these displays are seven-segment digits, and each one is recognised by looking at which of its
 * seven segments are dark. Pure Kotlin (no Android types), so the same code is tested on a computer
 * (MonitorReaderTest: hundreds of generated displays, and real photos when available).
 *
 * The rule is "a wrong number is worse than no number": the photo is read with several settings, every reading
 * must agree, every segment must be clearly on or clearly off, and the three values must be plausible. Otherwise
 * the answer is Retake with the reason, and the person takes the photo again or says the values aloud.
 */

/** A grey photo: luminance 0..255, row by row. */
class GrayImage(val w: Int, val h: Int, val px: IntArray) {
    init { require(w > 0 && h > 0 && px.size == w * h) }
}

sealed class MonitorRead {
    data class Ok(val sys: Int, val dia: Int, val pul: Int) : MonitorRead()
    /** reason: "dark", "glare", "blurry", "not_found", "unclear", "implausible". */
    data class Retake(val reason: String) : MonitorRead()
}

object MonitorReader {
    /** Tests only: what each attempt saw. */
    var debug: ((String) -> Unit)? = null
    var debugMask: ((String, BooleanArray, Int, Int) -> Unit)? = null
    /** The photo is reduced to this longest side: enough for the digits, fast on any phone. */
    private const val SIDE = 720
    private const val ON = 0.55      // every segment at least this dark: an 8
    private const val ON_MIN = 0.35  // an on segment is at least this dark
    private const val OFF = 0.18     // an off segment is at most this dark
    private const val GAP = 0.30     // and the darkest off segment is this much lighter than the lightest on one

    // segments a, b, c, d, e, f, g as bits 6..0 → digit
    private val PATTERNS = mapOf(
        0b1111110 to 0, 0b0110000 to 1, 0b1101101 to 2, 0b1111001 to 3, 0b0110011 to 4,
        0b1011011 to 5, 0b1011111 to 6, 0b0011111 to 6, 0b1110000 to 7, 0b1110010 to 7,
        0b1111111 to 8, 0b1111011 to 9, 0b1110011 to 9,
    )
    // where each segment lies in a digit cell: u across (0 left, 1 right), v down (0 top, 1 bottom)
    private val REGIONS = arrayOf(
        doubleArrayOf(0.30, 0.70, 0.00, 0.13),   // a
        doubleArrayOf(0.80, 1.00, 0.18, 0.38),   // b
        doubleArrayOf(0.80, 1.00, 0.62, 0.82),   // c
        doubleArrayOf(0.30, 0.70, 0.87, 1.00),   // d
        doubleArrayOf(0.00, 0.20, 0.62, 0.82),   // e
        doubleArrayOf(0.00, 0.20, 0.18, 0.38),   // f
        doubleArrayOf(0.30, 0.70, 0.44, 0.56),   // g
    )

    @Synchronized
    fun read(photo: GrayImage): MonitorRead {
        val g = shrink(photo, SIDE)
        if (g.px.average() < 40) return MonitorRead.Retake("dark")
        val sum = LongArray((g.w + 1) * (g.h + 1)); val sq = LongArray((g.w + 1) * (g.h + 1))
        integrals(g, sum, sq)
        // the slope of the rows of digits, measured by a first look
        val first = sauvola(g, sum, sq, 0.28); dropLarge(first, g.w, g.h)
        rowSlope = 0.0
        attempt(g, first, 3, emptyList(), mutableListOf(), { x, y -> x to y })
        val angle = kotlin.math.atan(rowSlope)
        debug?.invoke("angle=${"%.1f".format(Math.toDegrees(angle))}")
        // every number read by any attempt, with where it is in the photo (cx, cy, h, value or -1 when not clear, 1 if
        // a clock, left, right): a value is taken only where at least two readings agree and none disagrees (the
        // same place read as 53 and 63 is neither); which number is SYS, DIA or PUL comes from the layout
        val seen = mutableListOf<DoubleArray>()
        val layouts = mutableListOf<Layout>()
        val fails = mutableMapOf<String, Int>()
        // the photo as it is and, when it was taken at an angle, turned straight: each sees what the other misses
        val views = mutableListOf<Pair<GrayImage, (Double, Double) -> Pair<Double, Double>>>(g to { x, y -> x to y })
        if (abs(angle) > Math.toRadians(1.0)) {
            val a = -angle; val sn = kotlin.math.sin(a); val cs = kotlin.math.cos(a); val cx = g.w / 2.0; val cy = g.h / 2.0
            views.add(rotate(g, a) to { x, y -> (cs * (x - cx) + sn * (y - cy) + cx) to (-sn * (x - cx) + cs * (y - cy) + cy) })
        }
        for ((view, back) in views) {
            if (view !== g) integrals(view, sum, sq)
            for (k in doubleArrayOf(0.18, 0.28, 0.40)) {
                val ink = sauvola(view, sum, sq, k)
                debugMask?.invoke("raw$k" + (if (view === g) "" else "r"), ink.copyOf(), view.w, view.h)
                // where a frame was cut away: a number touching it may have lost part of a digit there
                val cut = BooleanArray(ink.size)
                dropLarge(ink, view.w, view.h, cut)
                debugMask?.invoke("k$k" + (if (view === g) "" else "r"), ink, view.w, view.h)
                val colons = colons(ink, view.w, view.h)
                // gaps inside a digit closed up-down at a few strengths; the lines are then found by geometry
                for (ry in intArrayOf(1, 3, 5)) {
                    val a = attempt(view, ink, ry, colons, seen, back, cut)
                    if (a is Layout) layouts.add(a) else if (a is String) fails[a] = (fails[a] ?: 0) + 1
                }
            }
        }
        val r = decide(layouts, seen)
        debug?.invoke("found=$r fails=$fails")
        if (r is MonitorRead.Ok) return r
        return MonitorRead.Retake(
            when {
                glare(g) -> "glare"
                blurry(g) -> "blurry"
                r != null -> (r as MonitorRead.Retake).reason
                else -> "not_found"
            }
        )
    }

    /** The values, or Retake when the layout or a value is not certain; null when no attempt found the display. */
    private fun decide(layouts: List<Layout>, seen: List<DoubleArray>): MonitorRead? {
        if (layouts.isEmpty()) return null
        fun same(a: Num, b: Num) = abs(a.ox - b.ox) < 0.5 * a.h && abs(a.oy - b.oy) < 0.5 * a.h && b.h.toDouble() / a.h in 0.7..1.4
        // the largest pressure pair any attempt found; another nearly as large somewhere else: which is which is not sure
        // a pair with nothing below it is not the pressure (that is a pulse and a clock, or the diastolic and the
        // pulse when the systolic was not seen)
        val full = layouts.filter { it.below }
        if (full.isEmpty()) { debug?.invoke("why: no pulse"); return MonitorRead.Retake("not_found") }
        val best = full.maxByOrNull { it.score }!!
        if (full.any { it.score >= 0.85 * best.score && !(same(best.sys, it.sys) && same(best.dia, it.dia)) }) { debug?.invoke("why: two layouts"); return MonitorRead.Retake("unclear") }
        val group = full.filter { same(best.sys, it.sys) && same(best.dia, it.dia) }
        val puls = group.mapNotNull { it.pul }
        if (puls.isEmpty()) { debug?.invoke("why: no pulse"); return MonitorRead.Retake(if (group.any { it.below }) "unclear" else "not_found") }
        val pul = puls.first()
        if (puls.any { !same(pul, it) }) { debug?.invoke("why: two pulses"); return MonitorRead.Retake("unclear") }
        fun value(n: Num): Int? {
            val here = seen.filter { o -> abs(o[0] - n.ox) < 0.5 * n.h && abs(o[1] - n.oy) < 0.5 * n.h && o[2] / n.h in 0.7..1.4 }
            // seen as a clock by a third of the readings: a clock, not a value
            if (here.count { it[4] > 0 } * 3 >= here.size) { debug?.invoke("why: clock at ${n.ox.toInt()},${n.oy.toInt()}"); return null }
            // 300 and more is on no row of a pressure display: an unlit segment read as lit (1 as 7, 8 for 0)
            var reads = here.filter { it[3] >= 0 && it[3] < 300 }
            // a reading one digit short where the box was narrower by about a digit: that digit was not seen (19 for
            // 193). Dropped only when the full reading is at least twice as frequent.
            val byValue = reads.groupBy { it[3].toInt() }
            if (byValue.size == 2) {
                val (l, sh) = byValue.entries.sortedByDescending { it.key.toString().length }.let { it[0] to it[1] }
                val ls = l.key.toString(); val ss = sh.key.toString()
                val shortBox = sh.value.all { o -> l.value.all { q -> (q[6] - q[5]) - (o[6] - o[5]) >= 0.25 * n.h } }
                if (ls.length == ss.length + 1 && (ls.startsWith(ss) || ls.endsWith(ss)) && shortBox && l.value.size >= 2 * sh.value.size) reads = l.value
            }
            val v = reads.map { it[3] }
            if (v.size < 2 || v.toSet().size != 1) debug?.invoke("why: values at ${n.ox.toInt()},${n.oy.toInt()}: $v")
            return if (v.size >= 2 && v.toSet().size == 1) v[0].toInt() else null
        }
        val s = value(best.sys); val d = value(best.dia); val p = value(pul)
        if (s == null || d == null || p == null) { debug?.invoke("why: unclear ${if (s == null) "sys" else if (d == null) "dia" else "pul"}"); return MonitorRead.Retake("unclear") }
        if (s !in 60..260 || d !in 30..160 || d >= s || s - d < 10 || p !in 30..220) return MonitorRead.Retake("implausible")
        return MonitorRead.Ok(s, d, p)
    }

    /** Where one attempt saw SYS, DIA and PUL (the pulse missing when not certain), and how large the pressure pair is. */
    private class Layout(val sys: Num, val dia: Num, val pul: Num?, val below: Boolean, val score: Int)

    /** The slope of the rows of digits seen by the last attempt. */
    private var rowSlope = 0.0

    private class Box(var x0: Int, var y0: Int, var x1: Int, var y1: Int) {
        val w get() = x1 - x0 + 1
        val h get() = y1 - y0 + 1
    }

    private class Num(val value: Int?, val clear: Boolean, var clock: Boolean, val left: Int, val top: Int, val right: Int, val bottom: Int) {
        val h = bottom - top + 1
        val cy = (top + bottom) / 2.0
        val cx = (left + right) / 2.0
        // the centre in the photo as taken (the attempt may have looked at it turned straight)
        var ox = cx; var oy = cy
    }

    /** Colons of a clock: two small square dots, one above the other. Returns (x, y, size) of each colon. */
    private fun colons(ink: BooleanArray, w: Int, h: Int): List<Triple<Double, Double, Int>> {
        val labels = IntArray(w * h)
        val dots = components(ink, w, h, labels).filter { it.n >= 4 && it.w in 2..40 && it.h in 2..40 && it.w.toDouble() / it.h in 0.5..2.0 && it.n >= 0.5 * it.w * it.h }
        val out = mutableListOf<Triple<Double, Double, Int>>()
        for (p in dots) for (q in dots) {
            if (q === p || q.y0 <= p.y1) continue
            val size = max(p.h, q.h)
            val gap = q.y0 - p.y1
            if (gap in size..size * 5 && abs((p.x0 + p.x1) - (q.x0 + q.x1)) / 2.0 <= size && q.h.toDouble() / p.h in 0.6..1.6)
                out.add(Triple((p.x0 + p.x1 + q.x0 + q.x1) / 4.0, (p.y0 + q.y1) / 2.0, size))
        }
        return out
    }

    private fun attempt(g: GrayImage, raw: BooleanArray, ry: Int, colons: List<Triple<Double, Double, Int>>, seen: MutableList<DoubleArray>, back: (Double, Double) -> Pair<Double, Double>, cut: BooleanArray? = null): Any {
        val rx = ry   // name for the debug line
        val joined = erode(dilate(raw, g.w, g.h, 1, ry), g.w, g.h, 1, ry)
        val labels = IntArray(g.w * g.h)
        val minH = max(12, g.h / 30)
        // marks of one line: they overlap in height and are close, relative to their size
        // a frame around the display (a large outline, nearly empty inside) is not a mark: it would tie every
        // number into one line
        val all = components(joined, g.w, g.h, labels)
        val frames = all.filter { it.w > g.w / 4 && it.h > g.h / 8 && it.n < 0.15 * it.w * it.h }.map { it.id }.toHashSet()
        val marks = all.filter { it.n >= 8 && it.h >= minH / 2 && it.h <= g.h * 6 / 10 && it.id !in frames }
        // the frame's own ink is taken out too: where it crosses a number's box it would join its digits
        val ink = if (frames.isEmpty()) raw else BooleanArray(raw.size) { raw[it] && labels[it] !in frames }
        val parent = IntArray(marks.size) { it }
        fun root(i: Int): Int { var r = i; while (parent[r] != r) r = parent[r]; return r }
        for (i in marks.indices) for (j in i + 1 until marks.size) {
            val a = marks[i]; val b = marks[j]
            val over = min(a.y1, b.y1) - max(a.y0, b.y0) + 1
            val gap = max(a.x0, b.x0) - min(a.x1, b.x1)
            val hr = b.h.toDouble() / a.h
            val side = over >= 0.5 * min(a.h, b.h) && gap <= 0.8 * max(a.h, b.h) && hr in 0.35..2.8
            if (side) parent[root(i)] = root(j)
        }
        val lines = marks.indices.groupBy { root(it) }.values.map { ids ->
            Box(ids.minOf { marks[it].x0 }, ids.minOf { marks[it].y0 }, ids.maxOf { marks[it].x1 }, ids.maxOf { marks[it].y1 })
        }.filter { it.h >= minH && it.w >= 0.5 * it.h }
        val bands = lines.flatMap { splitRows(it, ink, g.w, 0) }.flatMap { splitCols(it, ink, g.w) }.filter { it.h >= minH }
        // one display, one slant and one rotation: measured on every line, the middle value used for all of them
        val est = bands.mapNotNull { b -> straighten(b, ink, g.w)?.let { b to it } }.filter { it.second.third >= 2 }
        val glob = if (est.isEmpty()) null else {
            val byWeight = est.sortedBy { it.second.second }
            val ms = est.map { it.second.first }.sorted(); val ss = byWeight.map { it.second.second }
            Pair(ms[ms.size / 2], ss[ss.size / 2])
        }
        rowSlope = glob?.first ?: 0.0
        // each line read with the display's slant and with its own; a clear reading wins, two different clear readings
        // mean neither can be trusted
        val read = bands.mapNotNull { b ->
            val x = decodeLine(b, ink, g.w, glob)
            val y = if (glob == null) null else decodeLine(b, ink, g.w, null)
            when {
                x == null -> y
                y == null || !y.clear -> x
                !x.clear -> y
                x.value == y.value -> x
                else -> Num(null, false, x.clock || y.clock, x.left, x.top, x.right, x.bottom)
            }
        }
        // a number next to where a frame was cut away is not trusted
        fun nearCut(n: Num): Boolean {
            if (cut == null) return false
            for (y in max(0, n.top - 3)..min(g.h - 1, n.bottom + 3)) for (x in max(0, n.left - 3)..min(g.w - 1, n.right + 3)) if (cut[y * g.w + x]) return true
            return false
        }
        val nums = read.map { if (it.clear && nearCut(it)) Num(null, false, it.clock, it.left, it.top, it.right, it.bottom) else it }
        debug?.invoke("bands=${bands.map { "" + it.x0 + "," + it.y0 + " " + it.w + "x" + it.h }}")
        debug?.invoke("rx=$rx lines=${lines.size} bands=${bands.size} nums=${nums.map { n -> "" + n.value + (if (n.clear) "" else "?") + (if (n.clock) "c" else "") + "@" + n.left + "," + n.top + "h" + n.h }}")
        if (nums.isEmpty()) return "not_found"
        // a colon on the number's row, beside it or inside it: a clock
        val tallest = nums.maxOf { it.h }
        for (n in nums) if (n.h <= 0.7 * tallest && colons.any { (cx, cy, size) -> abs(cy - n.cy) <= 0.35 * n.h && cx >= n.left - 1.2 * n.h && cx <= n.right + 1.2 * n.h && size <= 0.3 * n.h }) n.clock = true
        // the rest of a clock: a number right next to a clock, on the same row, belongs to it (12:34 is often cut in two)
        val slope0 = glob?.first ?: 0.0
        var grew = true
        while (grew) {
            grew = false
            for (a in nums) if (!a.clock) for (c in nums) if (c.clock && c !== a && a.h.toDouble() / c.h in 0.6..1.6 && abs((a.cy - slope0 * a.cx) - (c.cy - slope0 * c.cx)) <= 0.5 * max(a.h, c.h) &&
                max(a.left, c.left) - min(a.right, c.right) <= 1.0 * max(a.h, c.h)) { a.clock = true; grew = true }
        }
        // the pressure: two numbers of the same size, one above the other, the largest such pair. A number that is
        // not clear is never skipped: taking the next one instead could put the diastolic in place of the systolic.
        var sys: Num? = null; var dia: Num? = null; var best = 0
        for (up in nums) for (dn in nums) {
            if (up === dn || up.clock || dn.clock || dn.top <= up.cy) continue
            val hr = dn.h.toDouble() / up.h
            val aligned = abs(up.right - dn.right) <= 0.7 * up.h || min(up.right, dn.right) - max(up.left, dn.left) >= 0.3 * min(up.right - up.left, dn.right - dn.left)
            if (hr !in 0.8..1.25 || !aligned || dn.top - up.bottom > 1.0 * up.h) continue
            val score = min(up.h, dn.h)
            if (score > best) { best = score; sys = up; dia = dn }
        }
        for (n in nums) { val (x, y) = back(n.cx, n.cy); n.ox = x; n.oy = y }
        for (n in nums) seen.add(doubleArrayOf(n.ox, n.oy, n.h.toDouble(), (n.value ?: -1).toDouble(), if (n.clock) 1.0 else 0.0, n.left.toDouble(), n.right.toDouble()))
        if (sys == null || dia == null) { debug?.invoke("why: no pair"); return "not_found" }
        // the pulse: the nearest number below the pressure that is not a clock (its value is decided across attempts)
        val slope = glob?.first ?: 0.0
        fun rowY(n: Num) = n.cy - slope * n.cx
        val below = nums.filter { it !== sys && it !== dia && it.h >= 0.3 * dia.h && !it.clock && it.cy > dia.cy }
        val near = below.filter { it.clear }.minWithOrNull(compareBy<Num>({ ((rowY(it) - rowY(dia)) / max(1, it.h)).roundToInt() }, { it.cx }))
        // a number nearer to the pressure that could not be read may be the real pulse: then this attempt does not say
        val pul = near?.takeIf { p -> below.none { !it.clear && it.h >= 0.6 * p.h && rowY(it) < rowY(p) - 0.5 * p.h } }
        // another number of the same size on the pulse's row that is not a clock (its colon may be too blurred to
        // see): which one is the pulse cannot be said for sure. Rows are compared with the photo's rotation removed.
        val alone = pul != null && nums.none { it !== pul && !it.clock && it.h >= 0.6 * pul.h && abs(rowY(it) - rowY(pul)) <= 0.5 * max(it.h, pul.h) }
        if (pul == null) debug?.invoke("why: pulse ${if (below.isEmpty()) "missing" else "unclear"}") else if (!alone) debug?.invoke("why: pulse row not alone")
        return Layout(sys, dia, if (alone) pul else null, below.isNotEmpty(), best)
    }

    /**
     * Which segments are on: the fills fall in two groups, dark and light, split where they differ most. The split
     * must be wide, the on segments clearly dark and the off ones clearly light; otherwise -1 (not clear).
     */
    private fun segments(f: DoubleArray): Int {
        val sorted = f.sorted()
        var cut = -1; var gap = 0.0; var second = 0.0
        for (i in 1 until 7) { val d = sorted[i] - sorted[i - 1]; if (d > gap) { second = gap; gap = d; cut = i } else if (d > second) second = d }
        // two splits almost as good as each other (a faint unlit segment half way): not clear which segments are on
        if (sorted[0] < ON && second >= 0.6 * gap) return -1
        val allOn = sorted[0] >= ON
        if (!allOn && (gap < GAP || sorted[cut] < ON_MIN || sorted[cut - 1] > OFF)) return -1
        val limit = if (allOn) 0.0 else (sorted[cut] + sorted[cut - 1]) / 2
        var bits = 0
        for (q in 0 until 7) if (f[q] > limit) bits = bits or (1 shl (6 - q))
        return bits
    }

    /** Two rows that touch (systolic and diastolic are close on many monitors): cut where the ink almost disappears. */
    private fun splitRows(b: Box, ink: BooleanArray, w: Int, depth: Int): List<Box> {
        // one row of two or three digits is wider than tall; numbers with only 1, 7 and 0 have no ink at mid-height,
        // so a row is cut only when the shape is too narrow to be a single row
        if (depth > 2 || b.h < 30 || b.w >= b.h) return listOf(trim(b, ink, w))
        val rows = IntArray(b.h)
        for (y in b.y0..b.y1) for (x in b.x0..b.x1) if (ink[y * w + x]) rows[y - b.y0]++
        val peak = rows.maxOrNull() ?: 0
        if (peak == 0) return emptyList()
        var cut = -1; var least = Int.MAX_VALUE
        for (i in (b.h * 25 / 100) until (b.h * 75 / 100)) if (rows[i] < least) { least = rows[i]; cut = i }
        if (cut < 0 || least > peak * 0.05) return listOf(trim(b, ink, w))
        return splitRows(trim(Box(b.x0, b.y0, b.x1, b.y0 + cut), ink, w), ink, w, depth + 1) +
            splitRows(trim(Box(b.x0, b.y0 + cut + 1, b.x1, b.y1), ink, w), ink, w, depth + 1)
    }

    /**
     * Two numbers on one row (the pulse and a clock): cut at a gap much wider than the usual gap on the row, when
     * each side has at least two digit-tall marks (a lone 1 before its number is never cut off).
     */
    private fun splitCols(b: Box, ink: BooleanArray, w: Int): List<Box> {
        val top = IntArray(b.w) { Int.MAX_VALUE }; val bot = IntArray(b.w) { -1 }
        for (y in b.y0..b.y1) for (x in b.x0..b.x1) if (ink[y * w + x]) { val c = x - b.x0; top[c] = min(top[c], y); bot[c] = max(bot[c], y) }
        // runs of columns with ink, and whether each is digit-tall
        val runs = mutableListOf<IntArray>()
        var c = 0
        while (c < b.w) {
            if (bot[c] < 0) { c++; continue }
            var e = c; var t = top[c]; var z = bot[c]
            while (e + 1 < b.w && bot[e + 1] >= 0) { e++; t = min(t, top[e]); z = max(z, bot[e]) }
            runs.add(intArrayOf(c, e, if (z - t + 1 >= 0.45 * b.h) 1 else 0)); c = e + 1
        }
        val gaps = (1 until runs.size).map { runs[it][0] - runs[it - 1][1] - 1 }.sorted()
        val usual = if (gaps.isEmpty()) 0 else gaps[(gaps.size - 1) / 2]
        for (i in 1 until runs.size) {
            val gap = runs[i][0] - runs[i - 1][1] - 1
            if (gap < 0.45 * b.h || gap < 2.5 * usual) continue
            val left = runs.subList(0, i).count { it[2] == 1 }; val right = runs.subList(i, runs.size).count { it[2] == 1 }
            if (left < 2 || right < 2) continue
            return splitCols(trim(Box(b.x0, b.y0, b.x0 + runs[i - 1][1], b.y1), ink, w), ink, w) +
                splitCols(trim(Box(b.x0 + runs[i][0], b.y0, b.x1, b.y1), ink, w), ink, w)
        }
        return listOf(b)
    }

    private fun trim(b: Box, ink: BooleanArray, w: Int): Box {
        var x0 = Int.MAX_VALUE; var x1 = -1; var y0 = Int.MAX_VALUE; var y1 = -1
        for (y in b.y0..b.y1) for (x in b.x0..b.x1) if (ink[y * w + x]) { x0 = min(x0, x); x1 = max(x1, x); y0 = min(y0, y); y1 = max(y1, y) }
        return if (x1 < 0) b else Box(x0, y0, x1, y1)
    }

    /**
     * One line of a display: straightened (rotation of the photo, then italic), cut into characters where a column is
     * empty, each character read segment by segment. Characters much shorter than the line are labels, icons or the
     * dots of a clock, not digits.
     */
    /** Rotation (slope) and italic (shear) of one line, and how many digit-tall characters it then has. */
    private fun straighten(b: Box, ink: BooleanArray, w: Int): Triple<Double, Double, Int>? {
        val xs = ArrayList<Int>(); val ys = ArrayList<Int>()
        for (y in b.y0..b.y1) for (x in b.x0..b.x1) if (ink[y * w + x]) { xs.add(x); ys.add(y) }
        if (xs.size < 30) return null
        val n = xs.size
        // rotation: the slope that makes the line thinnest (ink between its 2nd and 98th percentile)
        var m = 0.0; var bestH = Double.MAX_VALUE
        val tmp = DoubleArray(n)
        var mt = -0.3
        while (mt <= 0.301) {
            for (i in 0 until n) tmp[i] = ys[i] - mt * (xs[i] - b.x0)
            val sorted = tmp.sortedArray()
            val ext = sorted[(n * 98) / 100] - sorted[(n * 2) / 100]
            if (ext < bestH - 0.01) { bestH = ext; m = mt }
            mt += 0.02
        }
        val yr = DoubleArray(n) { ys[it] - m * (xs[it] - b.x0) }
        val sortedY = yr.sortedArray()
        val bottom = sortedY[(n * 99) / 100]; val hgt = bottom - sortedY[n / 100] + 1
        // italic: the shear that leaves the fewest columns with ink
        var sBest = 0.0; var fewest = Int.MAX_VALUE
        var st = -0.1
        while (st <= 0.401) {
            val cols = HashSet<Int>()
            for (i in 0 until n) cols.add((xs[i] - st * (bottom - yr[i])).roundToInt())
            if (cols.size < fewest) { fewest = cols.size; sBest = st }
            st += 0.02
        }
        // characters as tall as the line, after straightening
        val cols = HashMap<Int, Pair<Double, Double>>()
        for (i in 0 until n) { val c = (xs[i] - sBest * (bottom - yr[i])).roundToInt(); val p = cols[c]; cols[c] = if (p == null) yr[i] to yr[i] else min(p.first, yr[i]) to max(p.second, yr[i]) }
        var tall = 0; var prev = Int.MIN_VALUE; var runTop = 0.0; var runBot = 0.0
        for (c in cols.keys.sorted()) {
            val (t, bt) = cols[c]!!
            if (c != prev + 1) { if (prev != Int.MIN_VALUE && runBot - runTop + 1 >= 0.7 * hgt) tall++; runTop = t; runBot = bt } else { runTop = min(runTop, t); runBot = max(runBot, bt) }
            prev = c
        }
        if (prev != Int.MIN_VALUE && runBot - runTop + 1 >= 0.7 * hgt) tall++
        return Triple(m, sBest, tall)
    }

    private fun decodeLine(b: Box, ink: BooleanArray, w: Int, glob: Pair<Double, Double>?): Num? {
        val xs = ArrayList<Int>(); val ys = ArrayList<Int>()
        for (y in b.y0..b.y1) for (x in b.x0..b.x1) if (ink[y * w + x]) { xs.add(x); ys.add(y) }
        if (xs.size < 30) return null
        val n = xs.size
        val own = if (glob == null) straighten(b, ink, w) ?: return null else null
        val m = glob?.first ?: own!!.first
        val sBest = glob?.second ?: own!!.second
        val yr = DoubleArray(n) { ys[it] - m * (xs[it] - b.x0) }
        val sortedY = yr.sortedArray()
        val top = sortedY[(n * 1) / 100]; val bottom = sortedY[(n * 99) / 100]
        val hgt = bottom - top + 1
        if (hgt < 10) return null
        val xr = DoubleArray(n) { xs[it] - sBest * (bottom - yr[it]) }
        val lo = xr.minOrNull()!!.toInt() - 1; val hi = xr.maxOrNull()!!.toInt() + 1
        val colCount = IntArray(hi - lo + 1)
        for (i in 0 until n) if (yr[i] >= top - 0.05 * hgt && yr[i] <= bottom + 0.05 * hgt) colCount[(xr[i].roundToInt() - lo)]++
        // characters: runs of columns with ink
        data class Run(val a: Int, val z: Int, var top: Double = Double.MAX_VALUE, var bot: Double = -Double.MAX_VALUE)
        val runs = mutableListOf<Run>()
        var i = 0
        while (i < colCount.size) {
            if (colCount[i] == 0) { i++; continue }
            var j = i
            while (j + 1 < colCount.size && colCount[j + 1] > 0) j++
            runs.add(Run(i + lo, j + lo)); i = j + 1
        }
        for (k in 0 until n) { val c = xr[k].roundToInt(); val r = runs.firstOrNull { c in it.a..it.z } ?: continue; r.top = min(r.top, yr[k]); r.bot = max(r.bot, yr[k]) }
        val tall = runs.filter { it.bot - it.top + 1 >= 0.7 * hgt }
        if (tall.size !in 1..3) return null
        val first = tall.first(); val last = tall.last()
        // a colon among the short marks between or next to the digits: this is a clock
        val dots = runs.filter { it !in tall && it.z - it.a + 1 <= 0.3 * hgt && it.bot - it.top + 1 <= 0.8 * hgt && it.a >= first.a - 0.6 * hgt && it.z <= last.z + 0.6 * hgt }
        var clock = false
        for (d in dots) {
            // two dots one above the other: the ink of this narrow mark has an empty band in its middle
            val ys = (0 until n).filter { xr[it].roundToInt() in d.a..d.z }.map { yr[it] }.sorted()
            if (ys.size >= 6 && (1 until ys.size).any { ys[it] - ys[it - 1] >= 0.12 * hgt }) clock = true
        }
        debug?.invoke("   line@${b.x0},${b.y0} runs=${runs.map { "" + it.a + "-" + it.z + ":" + (it.bot - it.top + 1).toInt() }} hgt=${hgt.toInt()} tall=${tall.size} dots=${dots.size} clock=$clock")
        // one character only: a number too blurred to separate its digits, an icon, or the hour of a clock; never a value
        if (tall.size == 1) return Num(null, false, clock, b.x0, b.y0, b.x1, b.y1)
        // something of digit size just left of the number, or between its digits: a digit that was not read
        var clear = runs.none { it !in tall && it !in dots && it.bot - it.top + 1 >= 0.3 * hgt && it.z < first.a && it.z >= first.a - 0.9 * hgt } &&
            runs.none { it !in tall && it.bot - it.top + 1 >= 0.3 * hgt && it.a > first.a && it.z < last.z && it !in dots }
        val widths = tall.map { it.z - it.a + 1 }
        val full = widths.filter { it >= 0.38 * hgt }.sorted()
        val wRef = if (full.isNotEmpty()) full[(full.size - 1) / 2].toDouble() else 0.55 * hgt
        val digits = StringBuilder()
        for ((ti, r) in tall.withIndex()) {
            val wi = (r.z - r.a + 1).toDouble()
            // wider than any digit: on the last one, an icon joined on its right is cut away; anywhere else it is
            // two digits joined, not readable with certainty
            val joinedWide = wi > 1.45 * wRef || wi > 0.9 * hgt
            // on the first one, a flat line joined to its top or bottom on the left (the shadow of the frame) is cut
            // away too, but only when the part cut off is that line and nothing else
            var leftCut = false
            if (joinedWide && ti == 0 && tall.size >= 2 && full.size >= 2 && wi <= 3.0 * wRef) {
                val cutAt = r.z - wRef + 1
                leftCut = (0 until n).none { k -> xr[k] < cutAt - 1 && xr[k].roundToInt() in r.a..r.z && (yr[k] - top) / hgt in 0.25..0.75 }
            }
            if (joinedWide && !leftCut && (ti != tall.size - 1 || full.size < 2 || wi > 1.8 * wRef)) { clear = false; continue }
            // a narrow character can only be a 1: a bar down the upper and the lower half (its own width would
            // otherwise spill into the middle segments of a full-width cell)
            if (wi < 0.38 * hgt && !joinedWide) {
                val rowsUp = HashSet<Int>(); val rowsDn = HashSet<Int>()
                for (k in 0 until n) {
                    if (xr[k].roundToInt() !in r.a..r.z) continue
                    val v = (yr[k] - top) / hgt
                    if (v in 0.05..0.45) rowsUp.add(yr[k].roundToInt()) else if (v in 0.55..0.95) rowsDn.add(yr[k].roundToInt())
                }
                debug?.invoke("   one@${r.a},${b.y0} w=${wi.toInt()} up=${rowsUp.size} dn=${rowsDn.size} of ${(0.4 * hgt).toInt()}")
                if (rowsUp.size >= 0.22 * hgt && rowsDn.size >= 0.22 * hgt) digits.append(1) else clear = false
                continue
            }
            val cellW = if (joinedWide) wRef else wi
            val left = if (joinedWide && !leftCut) r.a.toDouble() else r.z - cellW + 1
            val cnt = IntArray(7)
            for (k in 0 until n) {
                val u = (xr[k] - left) / cellW; val v = (yr[k] - top) / hgt
                if (xr[k].roundToInt() !in r.a..r.z) continue
                for (q in 0 until 7) { val rg = REGIONS[q]; if (u >= rg[0] && u < rg[1] && v >= rg[2] && v < rg[3]) cnt[q]++ }
            }
            val fills = DoubleArray(7)
            for (q in 0 until 7) { val rg = REGIONS[q]; fills[q] = cnt[q] / max(1.0, (rg[1] - rg[0]) * cellW * (rg[3] - rg[2]) * hgt) }
            val bits = segments(fills)
            if (bits < 0) clear = false
            debug?.invoke("   digit@${r.a},${b.y0} w=${wi.toInt()} h=${hgt.toInt()} slope=${"%.2f".format(m)} shear=${"%.2f".format(sBest)} fills=${fills.joinToString(",") { "%.2f".format(it) }}")
            val dgt = PATTERNS[bits]
            if (dgt == null) clear = false else digits.append(dgt)
        }
        val value = if (clear && digits.length == tall.size && digits[0] != '0') digits.toString().toInt() else null
        // a dark vertical stroke as tall as a digit just left of the number: a 1 that was not separated (113 read as 13)
        var lost = false
        if (value != null) {
            val firstLeft = first.a
            for (c in (firstLeft - (1.2 * hgt).toInt()) until firstLeft - 1) {
                var tallInk = 0
                for (y in (top + 0.1 * hgt).toInt()..(bottom - 0.1 * hgt).toInt()) {
                    val x = (c + sBest * (bottom - y) + m * 0).roundToInt()
                    val yy = (y + m * (x - b.x0)).roundToInt()
                    if (x in 0 until w && yy >= 0 && yy * w + x < ink.size && ink[yy * w + x]) tallInk++
                }
                if (tallInk >= 0.55 * hgt) { lost = true; break }
            }
        }
        // where the number is in the photo, for choosing which row is which
        return Num(if (lost) null else value, value != null && !lost, clock, b.x0, b.y0, b.x1, b.y1)
    }

    /** The edge of the display, the device and the table are not digits: very large shapes are taken out. */
    private fun dropLarge(ink: BooleanArray, w: Int, h: Int, cut: BooleanArray? = null) {
        dropFrames(ink, w, h, cut)
        val labels = IntArray(w * h)
        for (b in components(ink, w, h, labels)) if (b.h > h * 6 / 10 || b.w > w * 7 / 10 || b.n < 6) clear(ink, labels, b, w)
    }

    /**
     * The frame around a display (four long straight edges) is cut away along its edges only: a digit or an icon
     * that touches the frame stays.
     */
    private fun dropFrames(ink: BooleanArray, w: Int, h: Int, cutOut: BooleanArray?) {
        val labels = IntArray(w * h)
        for (b in components(ink, w, h, labels)) {
            if (b.w < w / 5 || b.h < h / 14) continue
            fun row(y: Int): Int { var c = 0; for (x in b.x0..b.x1) if (labels[y * w + x] == b.id) c++; return c }
            fun col(x: Int): Int { var c = 0; for (y in b.y0..b.y1) if (labels[y * w + x] == b.id) c++; return c }
            // each edge: where it starts (a little way in, past a rounded corner or a mark beside the frame) and how
            // thick it is; 0 when there is no long straight edge on that side
            fun edge(from: Int, step: Int, count: (Int) -> Int, need: Double, reach: Int): IntArray {
                var k = 0
                while (k < reach && count(from + k * step) < need) k++
                if (k >= reach) return intArrayOf(0, 0)
                var t = 0
                while (t < 40 && k + t < 2 * reach && count(from + (k + t) * step) >= need) t++
                return intArrayOf(k, t)
            }
            val ry = max(6, b.h * 15 / 100); val rx = max(6, b.w * 15 / 100)
            val top = edge(b.y0, 1, ::row, 0.5 * b.w, ry); val bottom = edge(b.y1, -1, ::row, 0.5 * b.w, ry)
            val left = edge(b.x0, 1, ::col, 0.5 * b.h, rx); val right = edge(b.x1, -1, ::col, 0.5 * b.h, rx)
            val sides = listOf(top, bottom, left, right).count { it[1] > 0 }
            debug?.invoke("big ${b.x0},${b.y0} ${b.w}x${b.h} n=${b.n} edges ${top.toList()} ${bottom.toList()} ${left.toList()} ${right.toList()}")
            // a frame has at least three long straight sides; a filled shape or a single line is something else
            if (sides < 3 || b.n > 0.4 * b.w * b.h) continue
            for (y in b.y0..b.y1) for (x in b.x0..b.x1) {
                val i = y * w + x
                if (labels[i] != b.id) continue
                val cut = (top[1] > 0 && y - b.y0 < top[0] + top[1] + 2) || (bottom[1] > 0 && b.y1 - y < bottom[0] + bottom[1] + 2) ||
                    (left[1] > 0 && x - b.x0 < left[0] + left[1] + 2) || (right[1] > 0 && b.x1 - x < right[0] + right[1] + 2)
                if (cut) { ink[i] = false; cutOut?.set(i, true) }
            }
        }
    }

    private fun clear(ink: BooleanArray, labels: IntArray, b: Blob, w: Int) {
        for (y in b.y0..b.y1) for (x in b.x0..b.x1) { val i = y * w + x; if (labels[i] == b.id) ink[i] = false }
    }

    private class Blob(val id: Int, var x0: Int, var y0: Int, var x1: Int, var y1: Int, var n: Int) {
        val w get() = x1 - x0 + 1
        val h get() = y1 - y0 + 1
    }

    /* ---------- image steps ---------- */

    /** The photo turned by a (radians) around its centre; the edges are continued, so no new lines appear. */
    private fun rotate(g: GrayImage, a: Double): GrayImage {
        val sn = kotlin.math.sin(a); val cs = kotlin.math.cos(a)
        val out = IntArray(g.w * g.h); val cx = g.w / 2.0; val cy = g.h / 2.0
        for (y in 0 until g.h) for (x in 0 until g.w) {
            // where this pixel comes from in the photo
            val dx = x - cx; val dy = y - cy
            val sx = (cs * dx + sn * dy + cx).coerceIn(0.0, g.w - 1.001); val sy = (-sn * dx + cs * dy + cy).coerceIn(0.0, g.h - 1.001)
            val x0 = sx.toInt(); val y0 = sy.toInt(); val fx = sx - x0; val fy = sy - y0
            val i = y0 * g.w + x0
            val v = (1 - fx) * (1 - fy) * g.px[i] + fx * (1 - fy) * g.px[i + 1] + (1 - fx) * fy * g.px[i + g.w] + fx * fy * g.px[i + g.w + 1]
            out[y * g.w + x] = v.roundToInt()
        }
        return GrayImage(g.w, g.h, out)
    }

    private fun shrink(src: GrayImage, side: Int): GrayImage {
        val f = max(src.w, src.h).toDouble() / side
        if (f <= 1.0) return src
        val w = max(1, (src.w / f).toInt()); val h = max(1, (src.h / f).toInt())
        val out = IntArray(w * h)
        for (y in 0 until h) {
            val y0 = (y * f).toInt(); val y1 = min(src.h, ((y + 1) * f).toInt().coerceAtLeast(y0 + 1))
            for (x in 0 until w) {
                val x0 = (x * f).toInt(); val x1 = min(src.w, ((x + 1) * f).toInt().coerceAtLeast(x0 + 1))
                var s = 0L; var n = 0
                for (yy in y0 until y1) { val row = yy * src.w; for (xx in x0 until x1) { s += src.px[row + xx]; n++ } }
                out[y * w + x] = (s / n).toInt()
            }
        }
        return GrayImage(w, h, out)
    }

    private fun integrals(g: GrayImage, sum: LongArray, sq: LongArray) {
        val W = g.w + 1
        for (y in 0 until g.h) {
            var rs = 0L; var rq = 0L
            for (x in 0 until g.w) {
                val v = g.px[y * g.w + x].toLong(); rs += v; rq += v * v
                sum[(y + 1) * W + x + 1] = sum[y * W + x + 1] + rs
                sq[(y + 1) * W + x + 1] = sq[y * W + x + 1] + rq
            }
        }
    }

    /** Dark marks against their surroundings (Sauvola), so uneven light and faint unlit segments do not count. */
    private fun sauvola(g: GrayImage, sum: LongArray, sq: LongArray, k: Double): BooleanArray {
        val W = g.w + 1; val r = max(8, min(g.w, g.h) / 14)
        val out = BooleanArray(g.w * g.h)
        for (y in 0 until g.h) {
            val y0 = max(0, y - r); val y1 = min(g.h, y + r + 1)
            for (x in 0 until g.w) {
                val x0 = max(0, x - r); val x1 = min(g.w, x + r + 1)
                val n = ((y1 - y0) * (x1 - x0)).toDouble()
                val s = sum[y1 * W + x1] - sum[y0 * W + x1] - sum[y1 * W + x0] + sum[y0 * W + x0]
                val q = sq[y1 * W + x1] - sq[y0 * W + x1] - sq[y1 * W + x0] + sq[y0 * W + x0]
                val mean = s / n; val sd = sqrt(max(0.0, q / n - mean * mean))
                val t = mean * (1 + k * (sd / 128.0 - 1))
                val v = g.px[y * g.w + x]
                out[y * g.w + x] = v < t && sd > 12 && mean - v > 18
            }
        }
        return out
    }

    private fun boxCount(m: BooleanArray, w: Int, h: Int): IntArray {
        val W = w + 1; val c = IntArray(W * (h + 1))
        for (y in 0 until h) { var rs = 0; for (x in 0 until w) { if (m[y * w + x]) rs++; c[(y + 1) * W + x + 1] = c[y * W + x + 1] + rs } }
        return c
    }

    private fun dilate(m: BooleanArray, w: Int, h: Int, rx: Int, ry: Int): BooleanArray {
        val c = boxCount(m, w, h); val W = w + 1; val out = BooleanArray(w * h)
        for (y in 0 until h) { val y0 = max(0, y - ry); val y1 = min(h, y + ry + 1)
            for (x in 0 until w) { val x0 = max(0, x - rx); val x1 = min(w, x + rx + 1)
                out[y * w + x] = c[y1 * W + x1] - c[y0 * W + x1] - c[y1 * W + x0] + c[y0 * W + x0] > 0 } }
        return out
    }

    private fun erode(m: BooleanArray, w: Int, h: Int, rx: Int, ry: Int): BooleanArray {
        val c = boxCount(m, w, h); val W = w + 1; val out = BooleanArray(w * h)
        for (y in 0 until h) { val y0 = max(0, y - ry); val y1 = min(h, y + ry + 1)
            for (x in 0 until w) { val x0 = max(0, x - rx); val x1 = min(w, x + rx + 1)
                out[y * w + x] = c[y1 * W + x1] - c[y0 * W + x1] - c[y1 * W + x0] + c[y0 * W + x0] == (y1 - y0) * (x1 - x0) } }
        return out
    }

    private fun components(m: BooleanArray, w: Int, h: Int, labels: IntArray): List<Blob> {
        val out = mutableListOf<Blob>(); val queue = IntArray(w * h); var next = 1
        for (start in m.indices) {
            if (!m[start] || labels[start] != 0) continue
            val id = next++; var head = 0; var tail = 0
            queue[tail++] = start; labels[start] = id
            val b = Blob(id, start % w, start / w, start % w, start / w, 0)
            while (head < tail) {
                val p = queue[head++]; val x = p % w; val y = p / w; b.n++
                if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y
                for (dy in -1..1) for (dx in -1..1) {
                    val nx = x + dx; val ny = y + dy
                    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
                    val q = ny * w + nx
                    if (m[q] && labels[q] == 0) { labels[q] = id; queue[tail++] = q }
                }
            }
            out.add(b)
        }
        // pixels of the original marks keep the label of the closed shape they belong to
        return out
    }

    /** Large patches of pure white in the middle of the photo: a reflection on the display. */
    private fun glare(g: GrayImage): Boolean {
        var n = 0; var white = 0
        for (y in g.h / 6 until g.h * 5 / 6) for (x in g.w / 6 until g.w * 5 / 6) { n++; if (g.px[y * g.w + x] >= 248) white++ }
        return white > n * 0.015
    }

    /** Little detail anywhere (variance of the Laplacian): the photo is out of focus or moved. */
    private fun blurry(g: GrayImage): Boolean {
        var s = 0.0; var q = 0.0; var n = 0
        for (y in 1 until g.h - 1) for (x in 1 until g.w - 1) {
            val i = y * g.w + x
            val l = (4 * g.px[i] - g.px[i - 1] - g.px[i + 1] - g.px[i - g.w] - g.px[i + g.w]).toDouble()
            s += l; q += l * l; n++
        }
        val mean = s / n
        return q / n - mean * mean < 60.0
    }
}
