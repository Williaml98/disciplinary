package rw.ac.auca.caseflow.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MvcResult;
import rw.ac.auca.caseflow.domain.AppUser;
import rw.ac.auca.caseflow.domain.AppealStatus;
import rw.ac.auca.caseflow.domain.CaseStatus;
import rw.ac.auca.caseflow.domain.DecisionType;
import rw.ac.auca.caseflow.domain.DisciplinaryCase;
import rw.ac.auca.caseflow.domain.RegistrationStatus;
import rw.ac.auca.caseflow.domain.Role;
import rw.ac.auca.caseflow.repository.CaseRepository;

class ClearanceCertificateTest extends AbstractApiTest {

    @Autowired
    private CaseRepository caseRepository;

    private DisciplinaryCase createCase(String id, String studentId) {
        DisciplinaryCase disciplinaryCase = new DisciplinaryCase(
                id, "Some Student", studentId, "Some Reporter", "Computer Science",
                "Exam Cheating", "description", "evidence",
                LocalDate.of(2026, 1, 10), CaseStatus.REPORTED, RegistrationStatus.FLAGGED);
        return caseRepository.save(disciplinaryCase);
    }

    private String authHeader(AppUser user) {
        return "Bearer " + tokenFor(user);
    }

    @Test
    void clearanceCertificate_withoutToken_returnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/cases/CF-CLR-001/clearance-certificate")).andExpect(status().isUnauthorized());
    }

    @Test
    void clearanceCertificate_forClearedCase_asOwningStudent_succeeds() throws Exception {
        DisciplinaryCase disciplinaryCase = createCase("CF-CLR-002", "70001");
        disciplinaryCase.recordDecision(DecisionType.CLEARED, LocalDate.of(2026, 1, 20), null, null);
        caseRepository.save(disciplinaryCase);
        AppUser student = createUser("Cleared Student", "cleared1@student.auca.ac.rw", Role.STUDENT, "70001");

        MvcResult result = mockMvc.perform(get("/api/cases/CF-CLR-002/clearance-certificate")
                        .header("Authorization", authHeader(student)))
                .andExpect(status().isOk())
                .andReturn();

        assertThat(result.getResponse().getContentType()).isEqualTo("application/pdf");
        byte[] body = result.getResponse().getContentAsByteArray();
        assertThat(new String(body, 0, 5)).isEqualTo("%PDF-");
    }

    @Test
    void clearanceCertificate_forOverturnedAppealCase_asOwningStudent_succeeds() throws Exception {
        DisciplinaryCase disciplinaryCase = createCase("CF-CLR-003", "70002");
        disciplinaryCase.recordDecision(DecisionType.WARNING, LocalDate.of(2026, 1, 20), null, null);
        disciplinaryCase.submitAppeal("I did not do this.");
        disciplinaryCase.resolveAppeal(AppealStatus.OVERTURNED);
        caseRepository.save(disciplinaryCase);
        AppUser student = createUser("Overturned Student", "overturned1@student.auca.ac.rw", Role.STUDENT, "70002");

        mockMvc.perform(get("/api/cases/CF-CLR-003/clearance-certificate")
                        .header("Authorization", authHeader(student)))
                .andExpect(status().isOk());
    }

    @Test
    void clearanceCertificate_forCaseNotCleared_returnsConflict() throws Exception {
        DisciplinaryCase disciplinaryCase = createCase("CF-CLR-004", "70003");
        disciplinaryCase.recordDecision(DecisionType.WARNING, LocalDate.of(2026, 1, 20), null, null);
        caseRepository.save(disciplinaryCase);
        AppUser student = createUser("Warned Student", "warned1@student.auca.ac.rw", Role.STUDENT, "70003");

        mockMvc.perform(get("/api/cases/CF-CLR-004/clearance-certificate")
                        .header("Authorization", authHeader(student)))
                .andExpect(status().isConflict());
    }

    @Test
    void clearanceCertificate_forAnotherStudentsCase_isForbidden() throws Exception {
        DisciplinaryCase disciplinaryCase = createCase("CF-CLR-005", "70004");
        disciplinaryCase.recordDecision(DecisionType.CLEARED, LocalDate.of(2026, 1, 20), null, null);
        caseRepository.save(disciplinaryCase);
        AppUser otherStudent = createUser("Other Student", "otherstudent1@student.auca.ac.rw", Role.STUDENT, "99999");

        mockMvc.perform(get("/api/cases/CF-CLR-005/clearance-certificate")
                        .header("Authorization", authHeader(otherStudent)))
                .andExpect(status().isForbidden());
    }

    @Test
    void clearanceCertificate_asCommittee_forAnyClearedCase_succeeds() throws Exception {
        DisciplinaryCase disciplinaryCase = createCase("CF-CLR-006", "70005");
        disciplinaryCase.recordDecision(DecisionType.CLEARED, LocalDate.of(2026, 1, 20), null, null);
        caseRepository.save(disciplinaryCase);
        AppUser committee = createUser("Clearance Committee", "clearancecomm@auca.ac.rw", Role.COMMITTEE, null);

        mockMvc.perform(get("/api/cases/CF-CLR-006/clearance-certificate")
                        .header("Authorization", authHeader(committee)))
                .andExpect(status().isOk());
    }
}
