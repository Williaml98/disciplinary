package rw.ac.auca.caseflow.domain;

import java.util.Arrays;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Shared parsing for the display-string "wire values" every domain enum exposes via
 * {@code @JsonValue}/{@code @JsonCreator}.
 *
 * <p>Matching is format-insensitive: case, spaces, underscores and hyphens are all ignored, so
 * {@code "Under Review"}, {@code "UNDER_REVIEW"} and {@code "under-review"} all resolve to the same
 * constant. Callers that hold the raw Java constant name (rather than the frontend's display string)
 * therefore no longer fail to deserialize. The constant name itself is accepted as a fallback for the
 * same reason.
 */
final class WireValues {

    private WireValues() {
    }

    static <E extends Enum<E>> E parse(Class<E> type, String value, Function<E, String> wireValue, String label) {
        if (value != null) {
            String normalized = normalize(value);
            for (E constant : type.getEnumConstants()) {
                if (normalize(wireValue.apply(constant)).equals(normalized)
                        || normalize(constant.name()).equals(normalized)) {
                    return constant;
                }
            }
        }
        throw new IllegalArgumentException("Unknown %s: '%s'. Expected one of: %s".formatted(
                label,
                value,
                Arrays.stream(type.getEnumConstants()).map(wireValue).collect(Collectors.joining(", "))));
    }

    private static String normalize(String value) {
        StringBuilder normalized = new StringBuilder(value.length());
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (c != ' ' && c != '_' && c != '-') {
                normalized.append(Character.toLowerCase(c));
            }
        }
        return normalized.toString();
    }
}
