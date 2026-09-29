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
    @Test fun duplicateTestsRequireReviewInsteadOfPickingFirst() {
        assertTrue(parseLabLines("WBC 6.4 10^9/L 4-10\nWBC 7.1 10^9/L 4-10").isEmpty())
    }
    @Test fun preservesBoundedResultAndCanonicalUnit() {
        val row=parseLabLines("Lipase < 20 u/l < 60").single()
        assertEquals("< 20",row.value); assertEquals("U/L",row.unit); assertEquals("< 60",row.reference)
    }
}
