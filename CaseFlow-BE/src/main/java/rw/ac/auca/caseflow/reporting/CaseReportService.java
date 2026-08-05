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
