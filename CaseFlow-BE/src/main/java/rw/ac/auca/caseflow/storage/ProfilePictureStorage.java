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
 * Stores user avatars under {@code <uploads>/avatars/<userId>/}, following the same rules as
 * {@link EvidenceStorage}: server-generated UUID filenames, an allow-list of image types, and a
 * magic-byte check so the declared content type can't be spoofed.
 *
 * <p>Kept separate from EvidenceStorage rather than parameterised, because the two differ in what they
 * accept (no PDFs here), in size limit, and in retention — replacing an avatar deletes the old file,
 * whereas evidence is never removed.
 */
@Service
public class ProfilePictureStorage {

    private static final Map<String, String> ALLOWED_TYPES = Map.of(
            "image/jpeg", "jpg",
            "image/png", "png",
            "image/webp", "webp"
    );

    /** Avatars render at 40px; a couple of megabytes is already far more than needed. */
    public static final long MAX_FILE_SIZE_BYTES = 2L * 1024 * 1024;

    private static final Map<String, List<byte[]>> MAGIC_BYTES = Map.of(
            "image/jpeg", List.of(new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF}),
            "image/png", List.of(new byte[]{(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A}),
            "image/webp", List.of("RIFF".getBytes())
    );

    private static final Pattern SAFE_FILENAME = Pattern.compile("^[a-f0-9-]{36}\\.(jpg|jpeg|png|webp)$");

    private final Path root;

    public ProfilePictureStorage(@Value("${caseflow.uploads.dir}") String uploadsDir) {
        this.root = Path.of(uploadsDir).toAbsolutePath().normalize().resolve("avatars");
    }

    public String store(Long userId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No image was uploaded");
        }
        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Profile pictures must be %d MB or smaller".formatted(MAX_FILE_SIZE_BYTES / (1024 * 1024)));
        }
        String declaredType = file.getContentType() == null ? "" : file.getContentType().toLowerCase();
        String extension = ALLOWED_TYPES.get(declaredType);
        if (extension == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Profile pictures must be a JPEG, PNG or WEBP image");
        }
        if (!contentMatchesType(file, declaredType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "That file's contents don't match its type — it may be corrupt or renamed");
        }

        String filename = UUID.randomUUID() + "." + extension;
        try {
            Path dir = root.resolve(String.valueOf(userId));
            Files.createDirectories(dir);
            file.transferTo(dir.resolve(filename));
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to store profile picture", e);
        }
        return filename;
    }

    public Resource load(Long userId, String filename) {
        if (!SAFE_FILENAME.matcher(filename).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid profile picture filename");
        }
        Path file = root.resolve(String.valueOf(userId)).resolve(filename);
        if (!Files.isRegularFile(file)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Profile picture not found");
        }
        return new FileSystemResource(file);
    }

    /** Best-effort cleanup when an avatar is replaced or removed — a leftover file is not worth a 500. */
    public void delete(Long userId, String filename) {
        if (filename == null || !SAFE_FILENAME.matcher(filename).matches()) {
            return;
        }
        try {
            Files.deleteIfExists(root.resolve(String.valueOf(userId)).resolve(filename));
        } catch (IOException ignored) {
            // The database no longer references it; an orphaned file on disk is harmless.
        }
    }

    private static boolean contentMatchesType(MultipartFile file, String declaredType) {
        List<byte[]> signatures = MAGIC_BYTES.get(declaredType);
        if (signatures == null) {
            return false;
        }
        int longest = signatures.stream().mapToInt(s -> s.length).max().orElse(0);
        byte[] head = new byte[longest];
        try (InputStream in = file.getInputStream()) {
            if (in.readNBytes(head, 0, longest) < longest) {
                return false;
            }
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to read uploaded image", e);
        }
        return signatures.stream().anyMatch(signature -> {
            for (int i = 0; i < signature.length; i++) {
                if (head[i] != signature[i]) {
                    return false;
                }
            }
            return true;
        });
    }
}
