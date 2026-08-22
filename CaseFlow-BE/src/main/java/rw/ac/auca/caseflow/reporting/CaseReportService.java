package rw.ac.auca.caseflow.reporting;

import com.lowagie.text.BadElementException;
import com.lowagie.text.Chunk;
import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.Image;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.Rectangle;
import com.lowagie.text.pdf.ColumnText;
import com.lowagie.text.pdf.PdfContentByte;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfPageEventHelper;
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
import java.util.Locale;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import rw.ac.auca.caseflow.domain.AppealStatus;
import rw.ac.auca.caseflow.domain.DisciplinaryCase;
import rw.ac.auca.caseflow.reporting.CaseSpecifications.CaseReportFilters;

@Service
public class CaseReportService {

    // Same brand palette as the app shell and the email template.
    private static final Color NAVY = new Color(0x1D, 0x3A, 0x5F);
    private static final Color ACCENT = new Color(0x9C, 0xC7, 0xEE);
    private static final Color LIGHT_GRAY = new Color(0x6B, 0x72, 0x80);
    private static final Color INK = new Color(0x1F, 0x29, 0x37);
    private static final Color PANEL = new Color(0xF7, 0xF8, 0xFA);
    private static final Color STRIPE = new Color(0xF5, 0xF7, 0xFA);
    private static final Color BORDER = new Color(0xE5, 0xE7, 0xEB);
    private static final DateTimeFormatter TIMESTAMP_FORMAT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm").withZone(ZoneOffset.UTC);

    public byte[] generatePdf(List<DisciplinaryCase> cases, CaseReportFilters filters) {
        // Top margin leaves room for the header band the page event paints on every page.
        Document document = new Document(PageSize.A4.rotate(), 32, 32, 96, 48);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            PdfWriter writer = PdfWriter.getInstance(document, out);
            writer.setPageEvent(new BrandedPageDecorator("Disciplinary Case Report"));
            document.open();

            document.add(filterPanel(filters, cases.size()));
            document.add(Chunk.NEWLINE);
            document.add(caseTable(cases));
        } catch (DocumentException e) {
            throw new IllegalStateException("Failed to generate PDF report", e);
        } finally {
            document.close();
        }
        return out.toByteArray();
    }

    /** Self-describing summary block, so a printed or forwarded report still says what it covers. */
    private static PdfPTable filterPanel(CaseReportFilters filters, int matchCount) {
        Font labelFont = new Font(Font.HELVETICA, 7, Font.BOLD, LIGHT_GRAY);
        Font valueFont = new Font(Font.HELVETICA, 9, Font.NORMAL, INK);

        PdfPTable panel = new PdfPTable(new float[]{3f, 1f});
        panel.setWidthPercentage(100);
        panel.setSpacingBefore(4);

        PdfPCell filterCell = new PdfPCell();
        filterCell.addElement(new Paragraph("FILTERS APPLIED", labelFont));
        filterCell.addElement(new Paragraph(filters.describe(), valueFont));
        style(filterCell);
        panel.addCell(filterCell);

        PdfPCell countCell = new PdfPCell();
        countCell.addElement(new Paragraph("MATCHING CASES", labelFont));
        countCell.addElement(new Paragraph(String.valueOf(matchCount),
                new Font(Font.HELVETICA, 16, Font.BOLD, NAVY)));
        style(countCell);
        panel.addCell(countCell);

        return panel;
    }

    private static void style(PdfPCell cell) {
        cell.setBackgroundColor(PANEL);
        cell.setBorderColor(BORDER);
        cell.setBorderWidth(0.5f);
        cell.setPadding(10);
    }

    private static PdfPTable caseTable(List<DisciplinaryCase> cases) throws DocumentException {
        PdfPTable table = new PdfPTable(new float[]{1.2f, 1.7f, 0.9f, 1.7f, 1.5f, 1.1f, 1.3f, 0.9f});
        table.setWidthPercentage(100);
        // Repeat the header row when the table spills onto a second page.
        table.setHeaderRows(1);

        Font headerFont = new Font(Font.HELVETICA, 8, Font.BOLD, Color.WHITE);
        for (String header : new String[]{
                "Case ID", "Student", "Student ID", "Offense", "Reported By", "Status", "Decision", "Date"}) {
            PdfPCell cell = new PdfPCell(new Phrase(header.toUpperCase(Locale.ENGLISH), headerFont));
            cell.setBackgroundColor(NAVY);
            cell.setPadding(7);
            cell.setBorderWidth(0);
            cell.setVerticalAlignment(PdfPCell.ALIGN_MIDDLE);
            table.addCell(cell);
        }

        if (cases.isEmpty()) {
            // Without this an empty result set renders as a bare header row, which reads like a bug.
            PdfPCell empty = new PdfPCell(new Phrase(
                    "No cases matched these filters.", new Font(Font.HELVETICA, 10, Font.ITALIC, LIGHT_GRAY)));
            empty.setColspan(8);
            empty.setPadding(24);
            empty.setHorizontalAlignment(PdfPCell.ALIGN_CENTER);
            empty.setBorderColor(BORDER);
            table.addCell(empty);
            return table;
        }

        Font cellFont = new Font(Font.HELVETICA, 8.5f, Font.NORMAL, INK);
        Font idFont = new Font(Font.HELVETICA, 8.5f, Font.BOLD, NAVY);
        int row = 0;
        for (DisciplinaryCase disciplinaryCase : cases) {
            // Zebra striping makes a wide landscape row easier to track across the page.
            Color background = row++ % 2 == 0 ? Color.WHITE : STRIPE;
            addCell(table, disciplinaryCase.getId(), idFont, background);
            addCell(table, disciplinaryCase.getStudentName(), cellFont, background);
            addCell(table, disciplinaryCase.getStudentId(), cellFont, background);
            addCell(table, disciplinaryCase.getOffenseType(), cellFont, background);
            addCell(table, disciplinaryCase.getReportedBy(), cellFont, background);
            addCell(table, disciplinaryCase.getStatus().wireValue(), cellFont, background);
            addCell(table, disciplinaryCase.getDecision() == null
                    ? "-" : disciplinaryCase.getDecision().wireValue(), cellFont, background);
            addCell(table, String.valueOf(disciplinaryCase.getReportDate()), cellFont, background);
        }
        return table;
    }

    private static void addCell(PdfPTable table, String text, Font font, Color background) {
        PdfPCell cell = new PdfPCell(new Phrase(text == null ? "" : text, font));
        cell.setPadding(6);
        cell.setBackgroundColor(background);
        cell.setBorderColor(BORDER);
        cell.setBorderWidth(0.5f);
        cell.setVerticalAlignment(PdfPCell.ALIGN_MIDDLE);
        table.addCell(cell);
    }

    /**
     * Paints the AUCA logo, title and generation date at the top of every page, and a page number at
     * the foot. Done as a page event rather than inline content so multi-page reports stay branded and
     * every sheet is individually identifiable once printed.
     */
    private static final class BrandedPageDecorator extends PdfPageEventHelper {

        private final String title;
        private Image logo;

        private BrandedPageDecorator(String title) {
            this.title = title;
            try {
                ClassPathResource resource = new ClassPathResource("branding/logo.png");
                if (resource.exists()) {
                    logo = Image.getInstance(resource.getContentAsByteArray());
                    logo.scaleToFit(34, 34);
                }
            } catch (IOException | BadElementException e) {
                // A missing or unreadable logo must not fail the report — the band renders without it.
                logo = null;
            }
        }

        @Override
        public void onEndPage(PdfWriter writer, Document document) {
            Rectangle page = document.getPageSize();
            PdfContentByte canvas = writer.getDirectContentUnder();

            float bandHeight = 64f;
            canvas.saveState();
            canvas.setColorFill(NAVY);
            canvas.rectangle(0, page.getHeight() - bandHeight, page.getWidth(), bandHeight);
            canvas.fill();
            canvas.restoreState();

            float textLeft = document.leftMargin();
            if (logo != null) {
                try {
                    logo.setAbsolutePosition(document.leftMargin(), page.getHeight() - bandHeight + 15);
                    writer.getDirectContent().addImage(logo);
                    textLeft += 46;
                } catch (DocumentException e) {
                    // Fall through and render the text without the logo.
                }
            }

            ColumnText.showTextAligned(canvas, Element.ALIGN_LEFT,
                    new Phrase("CaseFlow", new Font(Font.HELVETICA, 15, Font.BOLD, Color.WHITE)),
                    textLeft, page.getHeight() - 30, 0);
            ColumnText.showTextAligned(canvas, Element.ALIGN_LEFT,
                    new Phrase(title.toUpperCase(Locale.ENGLISH),
                            new Font(Font.HELVETICA, 8, Font.NORMAL, ACCENT)),
                    textLeft, page.getHeight() - 44, 0);

            ColumnText.showTextAligned(canvas, Element.ALIGN_RIGHT,
                    new Phrase("Adventist University of Central Africa",
                            new Font(Font.HELVETICA, 9, Font.BOLD, Color.WHITE)),
                    page.getWidth() - document.rightMargin(), page.getHeight() - 30, 0);
            ColumnText.showTextAligned(canvas, Element.ALIGN_RIGHT,
                    new Phrase("Generated " + TIMESTAMP_FORMAT.format(Instant.now()) + " UTC",
                            new Font(Font.HELVETICA, 8, Font.NORMAL, ACCENT)),
                    page.getWidth() - document.rightMargin(), page.getHeight() - 44, 0);

            ColumnText.showTextAligned(canvas, Element.ALIGN_CENTER,
                    new Phrase("Page " + writer.getPageNumber() + "  ·  AUCA Disciplinary Committee  ·  Confidential",
                            new Font(Font.HELVETICA, 7.5f, Font.NORMAL, LIGHT_GRAY)),
                    page.getWidth() / 2, 24, 0);
        }
    }

    // Single-case certificate for a student whose case ended in their favor — see
    // CaseController.downloadClearanceCertificate for the "cleared" eligibility check.
    public byte[] generateClearanceCertificate(DisciplinaryCase disciplinaryCase) {
        // Top margin clears the branded header band painted by the page event.
        Document document = new Document(PageSize.A4, 54, 54, 96, 54);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            PdfWriter writer = PdfWriter.getInstance(document, out);
            writer.setPageEvent(new BrandedPageDecorator("Certificate of Clearance"));
            document.open();

            Font titleFont = new Font(Font.HELVETICA, 20, Font.BOLD, NAVY);
            Paragraph title = new Paragraph("Certificate of Clearance", titleFont);
            title.setSpacingBefore(12);
            document.add(title);

            Font metaFont = new Font(Font.HELVETICA, 9, Font.NORMAL, LIGHT_GRAY);
            document.add(new Paragraph("Case reference " + disciplinaryCase.getId(), metaFont));
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
