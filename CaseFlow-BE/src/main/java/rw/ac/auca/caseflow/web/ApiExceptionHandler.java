package rw.ac.auca.caseflow.web;

import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/**
 * Turns the malformed-request exceptions into the {@code {"message": "..."}} shape the frontend already
 * reads in {@code api.ts}'s {@code request()} helper, instead of a raw stack-trace-flavoured body.
 *
 * <p>Deliberately narrow: {@link org.springframework.web.server.ResponseStatusException} is left to
 * Spring's default handling, which already produces a {@code message} field thanks to
 * {@code server.error.include-message: always}.
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    /** Unparseable request body — most often an enum value that matches no wire value. */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, String>> handleUnreadableBody(HttpMessageNotReadableException e) {
        return message(rootCauseMessage(e, "Request body could not be read."));
    }

    /** A path variable or query parameter that could not be converted to its target type. */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Map<String, String>> handleTypeMismatch(MethodArgumentTypeMismatchException e) {
        return message(rootCauseMessage(e,
                "'%s' is not a valid value for %s.".formatted(e.getValue(), e.getName())));
    }

    /** Bean-validation failure on a request body — report the offending fields, not just "invalid". */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException e) {
        String details = e.getBindingResult().getFieldErrors().stream()
                .map(error -> "%s %s".formatted(error.getField(), error.getDefaultMessage()))
                .distinct()
                .collect(Collectors.joining("; "));
        return message(details.isBlank() ? "Some required fields are missing or invalid." : details);
    }

    /**
     * Our enums throw IllegalArgumentException with a message that already names the accepted values,
     * so surfacing the root cause is far more useful than the wrapper's generic text.
     */
    private static String rootCauseMessage(Throwable e, String fallback) {
        for (Throwable cause = e; cause != null; cause = cause.getCause()) {
            if (cause instanceof IllegalArgumentException && cause.getMessage() != null) {
                return cause.getMessage();
            }
        }
        return fallback;
    }

    private static ResponseEntity<Map<String, String>> message(String message) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", message));
    }
}
