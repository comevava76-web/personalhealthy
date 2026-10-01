package ch.personalhealthy.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.awt.BasicStroke
import java.awt.Color
import java.awt.Font
import java.awt.GradientPaint
import java.awt.Graphics2D
import java.awt.RadialGradientPaint
import java.awt.RenderingHints
import java.awt.geom.AffineTransform
import java.awt.geom.Path2D
import java.awt.geom.Rectangle2D
import java.awt.image.BufferedImage
import java.awt.image.ConvolveOp
import java.awt.image.Kernel
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import javax.imageio.IIOImage
import javax.imageio.ImageIO
import javax.imageio.ImageWriteParam
import kotlin.random.Random

/**
 * The monitor reader against photos generated here: different display layouts, italic digits, faint unlit segments
 * ("ghosts"), labels, icons and a clock, then the camera: rotation, slant, uneven light, reflections, blur, noise
 * and JPEG compression. The rule tested: never a wrong value; when the photo is hard, a retake is the right answer.
 * Real photos are read too when HINT_MONITOR_PHOTOS points to a folder with labels.csv (file,sys,dia,pul):
 * they are never committed (licences, and they are pictures of people's devices).
 */
class MonitorReaderTest {
    data class Truth(val sys: Int, val dia: Int, val pul: Int, val hard: Boolean, val why: String)

    @Test fun fourHundredGeneratedPhotos() {
        var right = 0; var wrong = 0; var retake = 0; var easy = 0; var easyRight = 0
        val reasons = mutableMapOf<String, Int>(); val wrongs = mutableListOf<String>(); val missed = mutableListOf<String>()
        val readSeeds = mutableListOf<Int>()
        for (seed in 1..400) {
            val (img, t) = SyntheticMonitor.photo(seed)
            if (!t.hard) easy++
            when (val r = MonitorReader.read(img)) {
                is MonitorRead.Ok -> if (r.sys == t.sys && r.dia == t.dia && r.pul == t.pul) { right++; if (!t.hard) { easyRight++; readSeeds.add(seed) } }
                    else { wrong++; wrongs.add("#$seed read ${r.sys}/${r.dia}/${r.pul}, was ${t.sys}/${t.dia}/${t.pul}") }
                is MonitorRead.Retake -> { retake++; reasons[r.reason] = (reasons[r.reason] ?: 0) + 1; if (!t.hard) missed.add("#$seed ${r.reason}") }
            }
        }
        println("generated: 400 photos, $easy easy · read right $right · retake $retake $reasons · WRONG $wrong")
        println("easy photos read: $easyRight / $easy · missed: ${missed.take(40)}")
        println("easy read: $readSeeds")
        wrongs.forEach { println("WRONG $it") }
        assertEquals("a wrong value must never be accepted", 0, wrong)
        // the aim is 90% of the easy photos; this floor only stops a change from making the reader worse
        assertTrue("easy photos read: $easyRight of $easy", easyRight >= easy * 0.62)
    }

    @Test fun realPhotosWhenAvailable() {
        val dir = System.getenv("HINT_MONITOR_PHOTOS")?.let(::File) ?: return
        val labels = File(dir, "labels.csv").takeIf { it.exists() } ?: return
        var right = 0; var wrong = 0; var retake = 0
        labels.readLines().drop(1).filter { it.isNotBlank() }.forEach { line ->
            val p = line.split(",").map { it.trim() }
            val img = ImageIO.read(File(dir, p[0])) ?: return@forEach
            when (val r = MonitorReader.read(gray(img))) {
                is MonitorRead.Ok -> if (r.sys == p[1].toInt() && r.dia == p[2].toInt() && (p.getOrNull(3).isNullOrEmpty() || r.pul == p[3].toInt())) right++
                    else { wrong++; println("WRONG ${p[0]}: ${r.sys}/${r.dia}/${r.pul}") }
                is MonitorRead.Retake -> { retake++; println("retake ${p[0]}: ${r.reason}") }
            }
        }
        println("real photos: right $right · retake $retake · WRONG $wrong")
        assertEquals(0, wrong)
    }

    /** HINT_DEBUG_SEEDS=1,2,3: writes those photos as PNG to HINT_DEBUG_DIR and prints what the reader saw. */
    @Test fun debugSeeds() {
        val seeds = System.getenv("HINT_DEBUG_SEEDS")?.split(",")?.mapNotNull { it.trim().toIntOrNull() } ?: return
        val dir = File(System.getenv("HINT_DEBUG_DIR") ?: "build"); dir.mkdirs()
        for (seed in seeds) {
            val (img, t) = SyntheticMonitor.photo(seed)
            val bi = BufferedImage(img.w, img.h, BufferedImage.TYPE_INT_RGB)
            for (i in img.px.indices) { val v = img.px[i]; bi.setRGB(i % img.w, i / img.w, (v shl 16) or (v shl 8) or v) }
            ImageIO.write(bi, "png", File(dir, "seed$seed.png"))
            println("=== seed $seed truth $t [${SyntheticMonitor.detail}]")
            MonitorReader.debug = { println(it) }
            MonitorReader.debugMask = { name, m, w, h ->
                val mi = BufferedImage(w, h, BufferedImage.TYPE_INT_RGB)
                for (i in m.indices) mi.setRGB(i % w, i / w, if (m[i]) 0 else 0xFFFFFF)
                ImageIO.write(mi, "png", File(dir, "seed$seed-$name.png"))
            }
            println("=> " + MonitorReader.read(img))
            MonitorReader.debug = null; MonitorReader.debugMask = null
        }
    }

    /** HINT_WHY=1: for every easy photo that is not read, why each attempt failed (counted). */
    @Test fun whyEasyPhotosFail() {
        if (System.getenv("HINT_WHY") == null) return
        val why = mutableMapOf<String, Int>(); val digitsWhy = mutableMapOf<String, Int>()
        for (seed in 1..400) {
            val (img, t) = SyntheticMonitor.photo(seed)
            if (t.hard) continue
            val lines = mutableListOf<String>()
            MonitorReader.debug = { lines.add(it) }
            val r = MonitorReader.read(img)
            MonitorReader.debug = null
            if (r is MonitorRead.Ok) { println("OKSEED #$seed [${SyntheticMonitor.detail}]"); continue }
            lines.filter { it.startsWith("why:") }.toSet().forEach { why[it] = (why[it] ?: 0) + 1 }
            println("FINAL #$seed [${SyntheticMonitor.detail}] ${lines.lastOrNull { it.startsWith("why:") }?.take(160)} ${lines.filter { it.startsWith("why: values") }.joinToString(" | ") { it.take(120) }}")
            val f = lines.firstOrNull { it.startsWith("found=") } ?: ""
            val k = "found " + (Regex("\\(").findAll(f.substringBefore("fails")).count())
            digitsWhy[k] = (digitsWhy[k] ?: 0) + 1
        }
        println("WHY " + why.entries.sortedByDescending { it.value } + " FOUND " + digitsWhy)
    }

    /** HINT_DEBUG_FILES=/a.jpg,/b.jpg: what the reader saw in those photos (masks next to them in HINT_DEBUG_DIR). */
    @Test fun debugFiles() {
        val files = System.getenv("HINT_DEBUG_FILES")?.split(",")?.map { File(it.trim()) } ?: return
        val dir = File(System.getenv("HINT_DEBUG_DIR") ?: "build"); dir.mkdirs()
        for (f in files) {
            val img = gray(ImageIO.read(f))
            println("=== file ${f.name}")
            MonitorReader.debug = { println(it) }
            MonitorReader.debugMask = { name, m, w, h ->
                val mi = BufferedImage(w, h, BufferedImage.TYPE_INT_RGB)
                for (i in m.indices) mi.setRGB(i % w, i / w, if (m[i]) 0 else 0xFFFFFF)
                ImageIO.write(mi, "png", File(dir, f.nameWithoutExtension + "-" + name + ".png"))
            }
            println("=> " + MonitorReader.read(img))
            MonitorReader.debug = null; MonitorReader.debugMask = null
        }
    }

    @Test fun darkPhotoAsksToRetake() {
        val img = GrayImage(300, 400, IntArray(300 * 400) { 12 })
        assertEquals(MonitorRead.Retake("dark"), MonitorReader.read(img))
    }

    companion object {
        fun gray(img: BufferedImage): GrayImage {
            val px = IntArray(img.width * img.height)
            for (y in 0 until img.height) for (x in 0 until img.width) {
                val c = img.getRGB(x, y)
                px[y * img.width + x] = (((c shr 16) and 255) * 299 + ((c shr 8) and 255) * 587 + (c and 255) * 114) / 1000
            }
            return GrayImage(img.width, img.height, px)
        }
    }
}

/** Photos of a blood-pressure monitor, made up from a seed: the same seed always gives the same photo. */
object SyntheticMonitor {
    /** Tests only: how the last photo was made. */
    var detail = ""
    // segments a..g of the digits 0..9
    private val SEG = arrayOf("abcdef", "bc", "abdeg", "abcdg", "bcfg", "acdfg", "acdefg", "abc", "abcdefg", "abcdfg")

    fun photo(seed: Int): Pair<GrayImage, MonitorReaderTest.Truth> {
        val rnd = Random(seed)
        val sys = rnd.nextInt(88, 201)
        val dia = rnd.nextInt(45, minOf(116, sys - 14))
        val pul = rnd.nextInt(45, 131)
        // the device and its display
        val sw = 900; val sh = 1150
        val scene = BufferedImage(sw, sh, BufferedImage.TYPE_INT_RGB)
        val g = scene.createGraphics()
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON)
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON)
        val bgTone = rnd.nextInt(40, 200)
        g.color = Color(bgTone, (bgTone * 0.9).toInt(), (bgTone * 0.8).toInt()); g.fillRect(0, 0, sw, sh)
        val body = Color(rnd.nextInt(200, 250), rnd.nextInt(200, 250), rnd.nextInt(200, 250))
        g.color = body; g.fillRoundRect(60, 60, sw - 120, sh - 120, 90, 90)
        val lcdB = rnd.nextInt(150, 216)
        val lcd = Color(lcdB - rnd.nextInt(0, 14), lcdB, lcdB - rnd.nextInt(0, 24))
        val lit = rnd.nextInt(18, 85)
        val ghost = if (rnd.nextDouble() < 0.65) rnd.nextInt(6, 40) else 0
        val slant = if (rnd.nextDouble() < 0.75) rnd.nextDouble(0.05, 0.2) else 0.0
        val thick = rnd.nextDouble(0.10, 0.17)
        val gap = rnd.nextDouble(0.006, 0.025)
        val layout = rnd.nextInt(3)
        val lx = 150; val ly = 190; val lw = 600; val lh = if (layout == 1) 430 else 620
        g.color = lcd; g.fillRect(lx, ly, lw, lh)
        // many displays sit in a dark frame that the digits nearly touch
        if (rnd.nextDouble() < 0.4) { g.color = Color(lit + 10, lit + 10, lit + 10); g.stroke = BasicStroke(rnd.nextInt(4, 12).toFloat()); g.drawRoundRect(lx + 2, ly + 2, lw - 4, lh - 4, 30, 30) }
        g.paint = GradientPaint(lx.toFloat(), ly.toFloat(), Color(0, 0, 0, 0), (lx + lw).toFloat(), (ly + lh).toFloat(), Color(0, 0, 0, rnd.nextInt(0, 40)))
        g.fillRect(lx, ly, lw, lh)
        g.color = Color(lit, lit, lit)
        g.font = Font(Font.SANS_SERIF, Font.BOLD, 30)
        g.drawString(listOf("OMRON", "paramed", "Beurer", "medisana", "HINT")[rnd.nextInt(5)], lx + 10, ly - 40)
        fun digitColor(on: Boolean) = if (on) Color(lit, lit, lit) else Color(lcd.red - ghost, lcd.green - ghost, lcd.blue - ghost)
        fun number(v: Int, cells: Int, right: Double, top: Double, h: Double) {
            val w = h * 0.55; val pitch = w * rnd.nextDouble(1.18, 1.32)
            val s = v.toString()
            for (i in 0 until cells) {
                val x = right - w - (cells - 1 - i) * pitch
                val ch = s.getOrNull(s.length - cells + i)
                digit(g, ch?.digitToInt(), x, top, w, h, thick * h, gap * h, slant, ::digitColor, ghost > 0)
            }
        }
        when (layout) {
            0 -> { // three rows, the pulse smaller (most upper-arm monitors)
                val h1 = lh * rnd.nextDouble(0.24, 0.29); val h3 = lh * rnd.nextDouble(0.17, 0.22)
                number(sys, 3, lx + lw - 30.0, ly + 25.0, h1)
                number(dia, 3, lx + lw - 30.0, ly + 50.0 + h1, h1)
                number(pul, 3, lx + lw - 30.0, ly + lh - 25.0 - h3, h3)
                g.color = Color(170, 60, 60); g.fillRect(lx + 20, ly + 40, 14, 120)
                g.color = Color(200, 190, 60); g.fillRect(lx + 20, ly + 160, 14, 80)
                g.color = Color(60, 150, 60); g.fillRect(lx + 20, ly + 240, 14, 120)
                g.color = Color(lit, lit, lit); g.font = Font(Font.SANS_SERIF, Font.BOLD, 22); g.drawString("AVG", lx + 160, ly + lh - 60)
            }
            1 -> { // pressure in one display, pulse and clock in a second one below (Omron style)
                val h1 = lh * rnd.nextDouble(0.36, 0.42)
                number(sys, 3, lx + lw - 90.0, ly + 25.0, h1)
                number(dia, 3, lx + lw - 90.0, ly + lh - 25.0 - h1, h1)
                g.color = Color(lit, lit, lit); g.stroke = BasicStroke(4f)
                g.drawOval(lx + lw - 75, ly + 70, 40, 34)
                val l2y = ly + lh + 60; val l2h = 130
                g.color = lcd; g.fillRect(lx, l2y, lw, l2h)
                val h3 = l2h * 0.62
                number(pul, 3, lx + 230.0, l2y + 25.0, h3)
                val hc = h3 * 0.8
                number(rnd.nextInt(0, 13), 1, lx + 420.0, l2y + 32.0, hc)
                number(rnd.nextInt(10, 60), 2, lx + 560.0, l2y + 32.0, hc)
                g.color = Color(lit, lit, lit); g.fillRect(lx + 430, l2y + 50, 8, 8); g.fillRect(lx + 430, l2y + 80, 8, 8)
                g.font = Font(Font.SANS_SERIF, Font.PLAIN, 26); g.color = Color(70, 70, 70)
                g.drawString("SYS", lx - 90, ly + 90); g.drawString("DIA", lx - 90, ly + 300); g.drawString("PULSE", lx - 120, l2y + 70)
            }
            else -> { // a date and a clock above, in small digits
                val hs = lh * 0.09
                number(rnd.nextInt(1, 13), 2, lx + 140.0, ly + 18.0, hs); number(rnd.nextInt(10, 29), 2, lx + 260.0, ly + 18.0, hs)
                number(rnd.nextInt(10, 24), 2, lx + 450.0, ly + 18.0, hs); number(rnd.nextInt(10, 60), 2, lx + 570.0, ly + 18.0, hs)
                val h1 = lh * rnd.nextDouble(0.22, 0.26); val h3 = lh * rnd.nextDouble(0.16, 0.2)
                number(sys, 3, lx + lw - 40.0, ly + 40.0 + hs, h1)
                number(dia, 3, lx + lw - 40.0, ly + 65.0 + hs + h1, h1)
                number(pul, 3, lx + lw - 40.0, ly + lh - 20.0 - h3, h3)
                g.color = Color(lit, lit, lit); g.font = Font(Font.SANS_SERIF, Font.BOLD, 24); g.drawString("MEM", lx + 30, ly + lh - 50)
            }
        }
        g.font = Font(Font.SANS_SERIF, Font.PLAIN, 24); g.color = Color(80, 80, 80)
        if (layout != 1) { g.drawString("SYS mmHg", lx + lw + 10, ly + 100); g.drawString("DIA mmHg", lx + lw + 10, ly + 300); g.drawString("PUL /min", lx + lw + 10, ly + lh - 60) }
        g.dispose()

        // the camera
        val pw = 1080; val ph = 1440
        val photo = BufferedImage(pw, ph, BufferedImage.TYPE_INT_RGB)
        val c = photo.createGraphics()
        c.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR)
        c.color = Color(bgTone, (bgTone * 0.9).toInt(), (bgTone * 0.8).toInt()); c.fillRect(0, 0, pw, ph)
        val angle = Math.toRadians(rnd.nextDouble(-12.0, 12.0))
        val scale = rnd.nextDouble(0.85, 1.25)
        val tr = AffineTransform()
        tr.translate(pw / 2.0 + rnd.nextDouble(-60.0, 60.0), ph / 2.0 + rnd.nextDouble(-60.0, 60.0))
        tr.rotate(angle); tr.scale(scale, scale); tr.shear(rnd.nextDouble(-0.06, 0.06), rnd.nextDouble(-0.04, 0.04))
        tr.translate(-sw / 2.0, -sh / 2.0)
        c.drawImage(scene, tr, null)
        // uneven light
        c.paint = GradientPaint(0f, 0f, Color(0, 0, 0, rnd.nextInt(0, 90)), pw.toFloat(), ph.toFloat(), Color(255, 255, 255, rnd.nextInt(0, 50)))
        c.fillRect(0, 0, pw, ph)
        // a reflection
        var glare = 0.0
        var glareOnDigits = false
        if (rnd.nextDouble() < 0.25) {
            glare = rnd.nextDouble(0.3, 0.95)
            val gx = rnd.nextInt(200, 880).toFloat(); val gy = rnd.nextInt(250, 1150).toFloat(); val gr = rnd.nextInt(60, 220).toFloat()
            c.paint = RadialGradientPaint(gx, gy, gr, floatArrayOf(0f, 1f), arrayOf(Color(255, 255, 255, (glare * 255).toInt()), Color(255, 255, 255, 0)))
            c.fill(Rectangle2D.Float(gx - gr, gy - gr, 2 * gr, 2 * gr))
            glareOnDigits = glare > 0.55
        }
        c.dispose()
        val blur = if (rnd.nextDouble() < 0.7) rnd.nextInt(0, 3) else rnd.nextInt(3, 7)
        var img = photo
        if (blur > 0) {
            val n = 2 * blur + 1; val k = FloatArray(n * n) { 1f / (n * n) }
            img = ConvolveOp(Kernel(n, n, k), ConvolveOp.EDGE_NO_OP, null).filter(img, null)
        }
        val noise = rnd.nextDouble(0.0, 10.0)
        val quality = rnd.nextDouble(0.45, 0.92).toFloat()
        val gray = MonitorReaderTest.gray(jpeg(img, quality))
        if (noise > 0) for (i in gray.px.indices) gray.px[i] = (gray.px[i] + rnd.nextDouble(-noise, noise)).toInt().coerceIn(0, 255)
        val contrast = (lcdB - lit)
        val hard = blur >= 4 || glareOnDigits || contrast < 80 || ghost > lcdB - lit - 60
        val why = listOfNotNull(if (blur >= 4) "blur$blur" else null, if (glareOnDigits) "glare" else null,
            if (contrast < 80) "contrast$contrast" else null, if (ghost > lcdB - lit - 60) "ghost$ghost" else null).joinToString(",")
        detail = "blur=$blur ghost=${"%.2f".format(ghost.toDouble() / contrast)} glare=${"%.2f".format(glare)} angle=${"%.0f".format(Math.toDegrees(angle))} slant=${"%.2f".format(slant)} layout=$layout contrast=$contrast"
        return gray to MonitorReaderTest.Truth(sys, dia, pul, hard, why)
    }

    private fun digit(g: Graphics2D, d: Int?, x: Double, y: Double, w: Double, h: Double, t: Double, gp: Double, slant: Double,
                      color: (Boolean) -> Color, ghosts: Boolean) {
        val on = if (d == null) "" else SEG[d]
        val l = x + t / 2; val r = x + w - t / 2; val top = y + t / 2; val mid = y + h / 2; val bot = y + h - t / 2
        val segs = mapOf(
            'a' to doubleArrayOf(l, top, r, top), 'g' to doubleArrayOf(l, mid, r, mid), 'd' to doubleArrayOf(l, bot, r, bot),
            'f' to doubleArrayOf(l, top, l, mid), 'b' to doubleArrayOf(r, top, r, mid), 'e' to doubleArrayOf(l, mid, l, bot), 'c' to doubleArrayOf(r, mid, r, bot),
        )
        for ((name, p) in segs) {
            val isOn = name in on
            if (!isOn && (!ghosts || d == null && name !in "bc")) continue
            g.color = color(isOn)
            val horizontal = p[1] == p[3]
            val path = Path2D.Double()
            fun pt(px: Double, py: Double, first: Boolean = false) { val sx = px + slant * (y + h - py); if (first) path.moveTo(sx, py) else path.lineTo(sx, py) }
            if (horizontal) {
                val x1 = p[0] + gp; val x2 = p[2] - gp; val yc = p[1]
                pt(x1, yc, true); pt(x1 + t / 2, yc - t / 2); pt(x2 - t / 2, yc - t / 2); pt(x2, yc); pt(x2 - t / 2, yc + t / 2); pt(x1 + t / 2, yc + t / 2)
            } else {
                val y1 = p[1] + gp; val y2 = p[3] - gp; val xc = p[0]
                pt(xc, y1, true); pt(xc + t / 2, y1 + t / 2); pt(xc + t / 2, y2 - t / 2); pt(xc, y2); pt(xc - t / 2, y2 - t / 2); pt(xc - t / 2, y1 + t / 2)
            }
            path.closePath(); g.fill(path)
        }
    }

    private fun jpeg(img: BufferedImage, q: Float): BufferedImage {
        val out = ByteArrayOutputStream()
        val w = ImageIO.getImageWritersByFormatName("jpg").next()
        w.output = ImageIO.createImageOutputStream(out)
        val p = w.defaultWriteParam.apply { compressionMode = ImageWriteParam.MODE_EXPLICIT; compressionQuality = q }
        w.write(null, IIOImage(img, null, null), p); w.dispose()
        return ImageIO.read(ByteArrayInputStream(out.toByteArray()))
    }
}
