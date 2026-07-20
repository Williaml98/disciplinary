package rw.ac.auca.caseflow.storage;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
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
 * Stores evidence photos on the local filesystem, one directory per case. Filenames are always
 * server-generated (UUID + extension derived from the validated content type) so neither the
 * upload nor the download path ever has to trust client-supplied path segments.
 */
@Service
public class EvidenceStorage {

    private static final Map<String, String> ALLOWED_TYPES = Map.of(
            "image/jpeg", "jpg",
            "image/png", "png",
            "image/gif", "gif",
            "image/webp", "webp"
    );

    private static final Pattern SAFE_FILENAME = Pattern.compile("^[a-f0-9-]{36}\\.(jpg|jpeg|png|gif|webp)$");
    private static final Pattern SAFE_CASE_ID = Pattern.compile("^[A-Za-z0-9-]+$");

    private final Path root;

    public EvidenceStorage(@Value("${caseflow.uploads.dir}") String uploadsDir) {
        this.root = Path.of(uploadsDir).toAbsolutePath().normalize();
    }

    public String store(String caseId, MultipartFile file) {
        requireSafeCaseId(caseId);
        String extension = ALLOWED_TYPES.get(file.getContentType());
        if (extension == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Only JPEG, PNG, GIF, or WEBP images are accepted as evidence");
        }
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
