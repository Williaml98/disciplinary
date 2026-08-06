package rw.ac.auca.caseflow.reporting;

import com.lowagie.text.Chunk;
import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Font;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.StringWriter;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.springframework.stereotype.Service;
import rw.ac.auca.caseflow.domain.AppealStatus;
import rw.ac.auca.caseflow.domain.DisciplinaryCase;
import rw.ac.auca.caseflow.reporting.CaseSpecifications.CaseReportFilters;

@Service
public class CaseReportService {

    private static final Color NAVY = new Color(0x1D, 0x3A, 0x5F);
    private static final Color LIGHT_GRAY = new Color(0x6B, 0x72, 0x80);
    private static final DateTimeFormatter TIMESTAMP_FORMAT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm").withZone(ZoneOffset.UTC);

    public byte[] generatePdf(List<DisciplinaryCase> cases, CaseReportFilters filters) {
        Document document = new Document(PageSize.A4.rotate(), 36, 36, 54, 36);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            PdfWriter.getInstance(document, out);
            document.open();

            Font titleFont = new Font(Font.HELVETICA, 18, Font.BOLD, NAVY);
            document.add(new Paragraph("CaseFlow — Disciplinary Case Report", titleFont));

            Font metaFont = new Font(Font.HELVETICA, 9, Font.NORMAL, LIGHT_GRAY);
            document.add(new Paragraph(
                    "Generated " + TIMESTAMP_FORMAT.format(Instant.now()) + " UTC · AUCA Disciplinary Committee", metaFont));
            document.add(new Paragraph(filters.describe(), metaFont));
            document.add(new Paragraph(cases.size() + " case(s) matched.", metaFont));
            document.add(Chunk.NEWLINE);

            PdfPTable table = new PdfPTable(new float[]{1.3f, 1.6f, 1f, 1.7f, 1.1f, 1.3f, 1f});
            table.setWidthPercentage(100);

            Font headerFont = new Font(Font.HELVETICA, 9, Font.BOLD, Color.WHITE);
            for (String header : new String[]{"Case ID", "Student", "Student ID", "Offense", "Status", "Decision", "Reported"}) {
                PdfPCell cell = new PdfPCell(new Phrase(header, headerFont));
                cell.setBackgroundColor(NAVY);
                cell.setPadding(6);
                table.addCell(cell);
            }

            Font cellFont = new Font(Font.HELVETICA, 9);
            for (DisciplinaryCase disciplinaryCase : cases) {
                addCell(table, disciplinaryCase.getId(), cellFont);
                addCell(table, disciplinaryCase.getStudentName(), cellFont);
                addCell(table, disciplinaryCase.getStudentId(), cellFont);
                addCell(table, disciplinaryCase.getOffenseType(), cellFont);
                addCell(table, disciplinaryCase.getStatus().wireValue(), cellFont);
                addCell(table, disciplinaryCase.getDecision() == null ? "—" : disciplinaryCase.getDecision().wireValue(), cellFont);
                addCell(table, disciplinaryCase.getReportDate().toString(), cellFont);
            }
            document.add(table);
        } catch (DocumentException e) {
            throw new IllegalStateException("Failed to generate PDF report", e);
        } finally {
            document.close();
        }
        return out.toByteArray();
    }

    private static void addCell(PdfPTable table, String text, Font font) {
        PdfPCell cell = new PdfPCell(new Phrase(text == null ? "" : text, font));
        cell.setPadding(5);
        table.addCell(cell);
    }

    // Single-case certificate for a student whose case ended in their favor — see
    // CaseController.downloadClearanceCertificate for the "cleared" eligibility check.
    public byte[] generateClearanceCertificate(DisciplinaryCase disciplinaryCase) {
        Document document = new Document(PageSize.A4, 54, 54, 54, 54);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            PdfWriter.getInstance(document, out);
            document.open();

            Font titleFont = new Font(Font.HELVETICA, 20, Font.BOLD, NAVY);
            document.add(new Paragraph("Certificate of Clearance", titleFont));

            Font metaFont = new Font(Font.HELVETICA, 9, Font.NORMAL, LIGHT_GRAY);
            document.add(new Paragraph(
                    "Issued " + TIMESTAMP_FORMAT.format(Instant.now()) + " UTC · AUCA Disciplinary Committee", metaFont));
            document.add(Chunk.NEWLINE);
            document.add(Chunk.NEWLINE);

            Font bodyFont = new Font(Font.HELVETICA, 11, Font.NORMAL, Color.DARK_GRAY);
            Font boldBodyFont = new Font(Font.HELVETICA, 11, Font.BOLD, Color.DARK_GRAY);

            Paragraph intro = new Paragraph();
            intro.setLeading(18);
            intro.add(new Chunk("This certifies that ", bodyFont));
            intro.add(new Chunk(disciplinaryCase.getStudentName(), boldBodyFont));
            intro.add(new Chunk(" (Student ID: ", bodyFont));
            intro.add(new Chunk(disciplinaryCase.getStudentId(), boldBodyFont));
            intro.add(new Chunk(") has been cleared of the disciplinary charge recorded under case ", bodyFont));
            intro.add(new Chunk(disciplinaryCase.getId(), boldBodyFont));
            intro.add(new Chunk(" (" + disciplinaryCase.getOffenseType() + "), reported "
                    + disciplinaryCase.getReportDate() + ".", bodyFont));
            document.add(intro);
            document.add(Chunk.NEWLINE);

            Paragraph basis = new Paragraph(basisStatement(disciplinaryCase), bodyFont);
            basis.setLeading(18);
            document.add(basis);
            document.add(Chunk.NEWLINE);

            Paragraph closing = new Paragraph(
                    "No disciplinary sanction stands against the student in relation to this case, "
                            + "and their registration status is unrestricted.", bodyFont);
            closing.setLeading(18);
            document.add(closing);
            document.add(Chunk.NEWLINE);
            document.add(Chunk.NEWLINE);

            Font signOffFont = new Font(Font.HELVETICA, 11, Font.ITALIC, Color.DARK_GRAY);
            document.add(new Paragraph("AUCA Disciplinary Committee", signOffFont));

            document.add(Chunk.NEWLINE);
            document.add(Chunk.NEWLINE);
            Font footerFont = new Font(Font.HELVETICA, 8, Font.NORMAL, LIGHT_GRAY);
            document.add(new Paragraph(
                    "This certificate is generated directly from CaseFlow case records and reflects the "
                            + "system's state as of the issue date above.", footerFont));
        } catch (DocumentException e) {
            throw new IllegalStateException("Failed to generate clearance certificate", e);
        } finally {
            document.close();
        }
        return out.toByteArray();
    }

    private static String basisStatement(DisciplinaryCase disciplinaryCase) {
        if (disciplinaryCase.getAppealStatus() == AppealStatus.OVERTURNED) {
            return "The committee's original decision on this case was overturned on appeal, "
                    + "and the matter was resolved fully in the student's favor.";
        }
        return "The Disciplinary Committee reviewed this case on " + disciplinaryCase.getDecisionDate()
                + " and recorded a decision of Cleared, finding no basis for disciplinary action.";
    }

    public byte[] generateCsv(List<DisciplinaryCase> cases) {
        StringWriter stringWriter = new StringWriter();
        try (CSVPrinter printer = new CSVPrinter(stringWriter, CSVFormat.DEFAULT.builder()
                .setHeader("Case ID", "Student Name", "Student ID", "Reported By", "Department",
                        "Offense Type", "Status", "Decision", "Report Date")
                .build())) {
            for (DisciplinaryCase disciplinaryCase : cases) {
                printer.printRecord(
                        disciplinaryCase.getId(),
                        disciplinaryCase.getStudentName(),
                        disciplinaryCase.getStudentId(),
                        disciplinaryCase.getReportedBy(),
                        disciplinaryCase.getReporterDepartment(),
                        disciplinaryCase.getOffenseType(),
                        disciplinaryCase.getStatus().wireValue(),
                        disciplinaryCase.getDecision() == null ? "" : disciplinaryCase.getDecision().wireValue(),
                        disciplinaryCase.getReportDate());
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return stringWriter.toString().getBytes(StandardCharsets.UTF_8);
    }
}
