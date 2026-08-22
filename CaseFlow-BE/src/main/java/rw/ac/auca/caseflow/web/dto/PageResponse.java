package rw.ac.auca.caseflow.web.dto;

import java.util.List;
import java.util.function.Function;
import org.springframework.data.domain.Page;

/**
 * Wire shape for paginated endpoints.
 *
 * <p>Deliberately hand-rolled rather than serializing Spring Data's {@code PageImpl}, whose JSON
 * structure is explicitly documented as unstable across versions and which leaks pageable internals
 * the frontend has no use for.
 */
public record PageResponse<T>(
        List<T> content,
        int page,
        int size,
        long totalElements,
        int totalPages,
        boolean first,
        boolean last
) {
    public static <E, T> PageResponse<T> of(Page<E> page, Function<E, T> mapper) {
        return new PageResponse<>(
                page.getContent().stream().map(mapper).toList(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages(),
                page.isFirst(),
                page.isLast());
    }
}
