package rw.ac.auca.caseflow.web.dto;

import jakarta.validation.constraints.NotNull;

/** Body for PATCH /api/users/{id}/status — the admin deactivate/reactivate toggle. */
public record UserStatusRequest(
        @NotNull Boolean active
) {
}
