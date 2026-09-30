package ch.personalhealthy.app
import org.junit.Assert.*
import org.junit.Test

class LabsParserTest {
    @Test fun multilingualRowsAndDecimalComma() {
        for (name in listOf("Globuli bianchi", "White blood cells", "Leukozyten", "Leucocytes")) {
            val row = parseLabLines("$name 6,4 10^9/L 4,0 - 10,0").single()
            assertEquals("wbc", row.code); assertEquals("6,4", row.value)
            assertEquals("10^9/L", row.unit); assertEquals("4,0 - 10,0", row.reference)
        }
    }
    @Test fun neverExtractsPatientHeadingsOrGuessesColumnOrder() {
        assertTrue(parseLabLines("Patient: White blood cells 6.4 10^9/L 4-10\nName: Jane Doe\nPatient ID 123456").isEmpty())
        assertTrue(parseLabLines("WBC 10^9/L 6.4 4-10").isEmpty())
        assertTrue(parseLabLines("WBC 6.4 4-10").isEmpty())
    }
    @Test fun duplicateTestsFailTheWholeReport() {
        val read = readLabText("Referto del 13-06-2026\nWBC 6.4 10^9/L 4-10\nWBC 7.1 10^9/L 4-10", today)
        assertEquals(LabRead.Failed("duplicate_tests"), read)
    }
    @Test fun preservesBoundedResultAndCanonicalUnit() {
        val row=parseLabLines("Lipase < 20 u/l < 60").single()
        assertEquals("< 20",row.value); assertEquals("U/L",row.unit); assertEquals("< 60",row.reference)
    }
    @Test fun laboratoryLabelsAndReferences() {
        val rows=parseLabLines("""
            Globuli Bianchi (WBC) 6,2 x10^9/L 4,0 - 9,5
            Globuli Rossi (RBC) 4,7 x10^12/L 4,0 - 5,4
            Emoglobina (Hgb) 141 g/L 130 - 170
            Volume corpuscolare medio (MCV) 89,2 fL 80,0 - 95,0
            Contenuto Medio Hgb (MCH) 30,0 pg 27,0 - 31,0
            Concentrazione Media Hgb (MCHC) 330 g/L 320 - 370
            Distribuzione Vol. Eritrocitario (RDW) 12,1 % 11,0 - 14,0
            Distribuzione Vol. Eritrocitario (RDW-SD) 41,0 fL 36,3 - 47,3
            Piastrine (PLTS) 250 x10^9/L 130 - 400
            MPV 9,5 FL 7,4 - 10,4
            S-CREATININA 0,95 mg/dL 0,73 - 1,18
            S-SODIO 140 mmol/L 136 - 146
            S-POTASSIO 4,1 mmol/L 3,4 - 5,1
            S-25-IDROSSI VITAMINA D 35,0 ng/mL Range previsto: 30-40 ng/ml
            S-ANTIGENE PROSTATICO SPECIFICO (PSA) 1,100 ng/mL < 4,000
            URINOCOLTURA NEGATIVA
        """.trimIndent())
        assertEquals(16, rows.size)
        assertEquals("141", rows.single { it.code=="hgb" }.value)
        assertEquals("10^12/L", rows.single { it.code=="rbc" }.unit)
        assertEquals("30-40", rows.single { it.code=="vitamin_d" }.reference)
        assertEquals("< 4,000", rows.single { it.code=="psa" }.reference)
        assertEquals(setOf("rdw", "rdw_sd"), rows.filter { it.code.startsWith("rdw") }.map { it.code }.toSet())
    }
    @Test fun differentialCountsAreSeparateFromPercentages() {
        val rows=parseLabLines("Granulociti Neutrofili 55,0 %\nGranulociti Neutrofili 3,50 x10^9/L 1,80 - 7,10\nLinfociti 32,0 %\nLinfociti assoluti 2,00 x10^9/L 0,80 - 4,30")
        assertEquals(4, rows.size)
        assertEquals("55,0", rows.single { it.code=="neutrophils_pct" }.value)
        assertEquals("3,50", rows.single { it.code=="neutrophils" }.value)
        assertTrue(parseLabLines("Monociti 0,5 mg/dL").isEmpty())
    }
    @Test fun labelsCannotHideAnIdentifierOrResultUnitOrder() {
        assertTrue(parseLabLines("WBC (Patient 123) 6.4 10^9/L 4-10").isEmpty())
        assertTrue(parseLabLines("S-CREATININA ID123 1.1 mg/dL").isEmpty())
        assertTrue(parseLabLines("WBC x10^9/L 6.4 4-10").isEmpty())
    }
    @Test fun qualitativeResultsStayTextAndCannotCarryPatientNarratives() {
        for (result in listOf("NEGATIVA", "POSITIVA", "negative", "positive", "negativ", "positiv", "négative", "positif", "assente", "presente", "non rilevato")) {
            val row=parseLabLines("URINOCOLTURA $result").single()
            assertEquals("urine_culture", row.code)
            assertEquals(result, row.value)
            assertEquals("", row.unit)
        }
        assertTrue(parseLabLines("URINOCOLTURA NEGATIVA Patient Jane Doe").isEmpty())
    }
    @Test fun datesMustBelongToTheReportAndBeUnambiguous() {
        assertEquals("2026-06-13", parseLabReportDate("Nato il 01-01-1980\nReferto del 13-06-2026 alle ore 12:12")?.toString())
        assertEquals("2026-06-13", parseLabReportDate("Report date: 2026-06-13")?.toString())
        assertNull(parseLabReportDate("Nato il 13-06-1980\nAccettazione del 12-06-2026"))
        assertNull(parseLabReportDate("Referto del 31-02-2026"))
        assertNull(parseLabReportDate("Referto del 13-06-2026\nReferto del 14-06-2026"))
    }

    private val today = java.time.LocalDate.of(2026, 10, 1)

    @Test fun wholeReportWithTestsOutsideTheCatalog() {
        val read = readLabText("""
            Laboratorio Analisi Esempio - Via Roma 12, 6900 Lugano - Tel 091 000 00 00
            Paziente: Test Persona   Nato il 01-01-1980
            Data prelievo: 10-06-2026   Referto del 13-06-2026
            Esame Risultato Unità Valori di riferimento
            Globuli bianchi 6,4 x10^9/L 4,0 - 10,0
            Emoglobina 141 g/L 130 - 170
            Fibrinogeno 310 mg/dL 200 - 400
            INR 1,02 0,80 - 1,20
            VES 12 mm/h 0 - 20
            Proteine totali 7,1 g/dL 6,4 - 8,3
            Filtrato glomerulare stimato 95 mL/min/1.73 m² > 60
            Colesterolo totale 180 mg/dL
            Desiderabile < 200
            Anticorpi anti HCV NEGATIVO
            Pagina 1 - 2
        """.trimIndent(), today)
        assertTrue(read is LabRead.Ok)
        read as LabRead.Ok
        assertEquals("2026-06-13", read.date.toString())
        assertEquals(9, read.values.size)
        val fib = read.values.single { it.label == "Fibrinogeno" }
        assertEquals("", fib.code); assertEquals("310", fib.value); assertEquals("mg/dL", fib.unit); assertEquals("200 - 400", fib.reference)
        assertEquals("", read.values.single { it.label == "INR" }.unit)
        assertEquals("NEGATIVO", read.values.single { it.label == "Anticorpi anti HCV" }.value)
        assertEquals("wbc", read.values.first().code)
        assertTrue(read.values.none { it.label.contains("Paziente") || it.label.contains("Via") })
    }
    @Test fun aRowThatIsNotUnderstoodBlocksTheWholeReport() {
        val read = readLabText("Referto del 13-06-2026\nEmoglobina 141 g/L 130 - 170\nFibrinogeno 310 mg/dL 200 - 400 metodo coagulativo", today)
        assertEquals(LabRead.Failed("unreadable_rows", 1), read)
        assertEquals(LabRead.Failed("unreadable_rows", 1), readLabText("Referto del 13-06-2026\nS-CREATININA ID123 1.1 mg/dL", today))
        assertEquals(LabRead.Failed("unreadable_rows", 1), readLabText("Referto del 13-06-2026\n25-OH colecalciferolo 30 ng/mL", today))
    }
    @Test fun personalDetailsNeverBecomeTests() {
        for (line in listOf("Mario Rossi 45 anni", "Paziente Mario Rossi 45 kg", "Patient ID 123456", "Tel 091 123-456"))
            assertTrue(line, parseLabLines(line).isEmpty())
    }
    @Test fun theDateMustBeCertain() {
        assertEquals(LabRead.Failed("no_date"), readLabText("Emoglobina 141 g/L 130 - 170", today))
        assertEquals(LabRead.Failed("ambiguous_date"), readLabText("Referto del 13-06-2026\nReferto del 14-06-2026\nEmoglobina 141 g/L 130 - 170", today))
        assertEquals(LabRead.Failed("future_date"), readLabText("Referto del 13-06-2027\nEmoglobina 141 g/L 130 - 170", today))
        val old = readLabText("Data prelievo 02/03/2024\nEmoglobina 141 g/L 130 - 170", today) as LabRead.Ok
        assertEquals("2024-03-02", old.date.toString())
        assertEquals(LabRead.Failed("no_results"), readLabText("Referto del 13-06-2026\nNessun esame", today))
    }
    @Test fun sameTestTwiceHasTheSameKey() {
        val a = parseLabLines("Fibrinogeno 310 mg/dL 200 - 400").single()
        val b = parseLabLines("FIBRINOGENO 290 mg/dl 200 - 400").single()
        assertEquals(a.key, b.key)
    }
    @Test fun outsideTheReferencePrintedOnTheReport() {
        assertEquals(1, LabValue("", "11,2", "", "4,0 - 10,0", "X").outOfRange())
        assertEquals(-1, LabValue("", "3.9", "", "4.0-10.0", "X").outOfRange())
        assertEquals(0, LabValue("", "10,0", "", "4,0 - 10,0", "X").outOfRange())
        assertEquals(1, LabValue("", "4,1", "", "< 4,000", "X").outOfRange())
        assertEquals(-1, LabValue("", "35", "", "> 40", "X").outOfRange())
        assertEquals(0, LabValue("", "< 20", "", "< 60", "X").outOfRange())
        assertEquals(0, LabValue("", "NEGATIVO", "", "", "X").outOfRange())
    }
    @Test fun sameTestFromDifferentLaboratoriesIsOneRow() {
        // units differ between laboratories: one row, each value with its own unit
        assertEquals(parseLabLines("Fibrinogeno 310 mg/dL 200 - 400").single().key, parseLabLines("FIBRINOGÈNO 3,1 g/L 2,0 - 4,0").single().key)
        // synonyms of the catalog share the code
        assertEquals("urea", parseLabLines("Azotemia 35 mg/dL 15 - 50").single().code)
        assertEquals("urea", parseLabLines("Urea 35 mg/dL 15 - 50").single().code)
        assertEquals("uric", parseLabLines("Acido urico 5,1 mg/dL 3,4 - 7,0").single().code)
        assertEquals("alt", parseLabLines("GPT 25 U/L < 40").single().code)
        // qualifiers the laboratory adds to a name
        assertEquals("glucose", parseLabLines("Glucosio a digiuno 90 mg/dL 70 - 100").single().code)
        assertEquals("ldl", parseLabLines("Colesterolo LDL calcolato 120 mg/dL < 130").single().code)
        // but never another specimen on the blood row
        assertTrue(parseLabLines("Glucosio nelle urine 50 mg/dL").isEmpty())
        assertEquals(LabRead.Failed("unreadable_rows", 1), readLabText("Referto del 13-06-2026\nGlucosio nelle urine 50 mg/dL", today))
    }
}
