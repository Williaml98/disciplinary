package rw.ac.auca.caseflow.storage;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/**
 * Stores evidence files on the local filesystem, one directory per case. Filenames are always
 * server-generated (UUID + extension derived from the validated content type) so neither the
 * upload nor the download path ever has to trust client-supplied path segments.
 *
 * <p>Accepted content is validated twice: the declared MIME type must be on the allow-list, and the
 * file's leading bytes must actually match that type. Sniffing matters because {@code getContentType()}
 * is just a header the client chose — without it, any file at all could be stored and later served back
 * under an image content type.
 */
@Service
public class EvidenceStorage {

    /** Images the frontend gallery can render inline, plus PDFs for scanned or signed documents. */
    private static final Map<String, String> ALLOWED_TYPES = Map.of(
            "image/jpeg", "jpg",
            "image/png", "png",
            "image/gif", "gif",
            "image/webp", "webp",
            "application/pdf", "pdf"
    );

    /** Per-file ceiling. Below the 8MB container limit so callers get a useful message, not a 413. */
    public static final long MAX_FILE_SIZE_BYTES = 8L * 1024 * 1024;

    /** Guards against a single request creating an unbounded number of files. */
    public static final int MAX_FILES_PER_UPLOAD = 10;

    private static final Pattern SAFE_FILENAME = Pattern.compile("^[a-f0-9-]{36}\\.(jpg|jpeg|png|gif|webp|pdf)$");
    private static final Pattern SAFE_CASE_ID = Pattern.compile("^[A-Za-z0-9-]+$");

    /** Leading bytes that must be present for each accepted type. */
    private static final Map<String, List<byte[]>> MAGIC_BYTES = Map.of(
            "image/jpeg", List.of(new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF}),
            "image/png", List.of(new byte[]{(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A}),
            "image/gif", List.of("GIF87a".getBytes(), "GIF89a".getBytes()),
            // WEBP is RIFF....WEBP — the 4-byte length at offset 4 varies, so check both fixed parts.
            "image/webp", List.of("RIFF".getBytes()),
            "application/pdf", List.of("%PDF-".getBytes())
    );

    private final Path root;

    public EvidenceStorage(@Value("${caseflow.uploads.dir}") String uploadsDir) {
        this.root = Path.of(uploadsDir).toAbsolutePath().normalize();
    }

    /** Validates every file before any of them is written, so a rejected batch leaves nothing on disk. */
    public void validateAll(List<MultipartFile> files) {
        if (files == null || files.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No files were uploaded");
        }
        if (files.size() > MAX_FILES_PER_UPLOAD) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "You can attach at most " + MAX_FILES_PER_UPLOAD + " files at a time");
        }
        files.forEach(EvidenceStorage::validate);
    }

    private static String validate(MultipartFile file) {
        if (file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "One of the selected files is empty");
        }
        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Each file must be %d MB or smaller".formatted(MAX_FILE_SIZE_BYTES / (1024 * 1024)));
        }
        String declaredType = file.getContentType() == null ? "" : file.getContentType().toLowerCase();
        String extension = ALLOWED_TYPES.get(declaredType);
        if (extension == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Only JPEG, PNG, GIF, WEBP images or PDF documents are accepted as evidence");
        }
        if (!contentMatchesType(file, declaredType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "That file's contents don't match its type — it may be corrupt or renamed");
        }
        return extension;
    }

    private static boolean contentMatchesType(MultipartFile file, String declaredType) {
        List<byte[]> signatures = MAGIC_BYTES.get(declaredType);
        if (signatures == null) {
            return false;
        }
        int longest = signatures.stream().mapToInt(s -> s.length).max().orElse(0);
        byte[] head = new byte[longest];
        try (InputStream in = file.getInputStream()) {
            int read = in.readNBytes(head, 0, longest);
            if (read < longest) {
                return false;
            }
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to read uploaded file", e);
        }
        return signatures.stream().anyMatch(signature -> startsWith(head, signature));
    }

    private static boolean startsWith(byte[] head, byte[] signature) {
        for (int i = 0; i < signature.length; i++) {
            if (head[i] != signature[i]) {
                return false;
            }
        }
        return true;
    }

    public String store(String caseId, MultipartFile file) {
        requireSafeCaseId(caseId);
        String extension = validate(file);
        String filename = UUID.randomUUID() + "." + extension;
        try {
            Path dir = root.resolve(caseId);
            Files.createDirectories(dir);
            file.transferTo(dir.resolve(filename));
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to store evidence file", e);
        }
        return filename;
    }

    public Resource load(String caseId, String filename) {
        requireSafeCaseId(caseId);
        if (!SAFE_FILENAME.matcher(filename).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid evidence filename");
        }
        Path file = root.resolve(caseId).resolve(filename);
        if (!Files.isRegularFile(file)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Evidence file not found");
        }
        return new FileSystemResource(file);
    }

    private static void requireSafeCaseId(String caseId) {
        if (!SAFE_CASE_ID.matcher(caseId).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid case id");
        }
    }
}
