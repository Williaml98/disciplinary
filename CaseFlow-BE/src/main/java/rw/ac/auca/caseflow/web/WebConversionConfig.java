package rw.ac.auca.caseflow.web;

import org.springframework.context.annotation.Configuration;
import org.springframework.format.FormatterRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import rw.ac.auca.caseflow.domain.AppealStatus;
import rw.ac.auca.caseflow.domain.CaseStatus;
import rw.ac.auca.caseflow.domain.DecisionType;
import rw.ac.auca.caseflow.domain.RegistrationStatus;
import rw.ac.auca.caseflow.domain.Role;

/**
 * Teaches Spring MVC to bind query parameters using each enum's wire value.
 *
 * <p>Without this, Spring falls back to {@code Enum.valueOf()}, which knows nothing about the
 * {@code @JsonValue}/{@code @JsonCreator} pair on these enums — those are Jackson's, so they only ever
 * applied to request <em>bodies</em>. That made every wire value a 400 as a query parameter:
 * {@code GET /api/cases/report?status=Under Review} and {@code ?decision=Semester Suspension} both
 * failed, which silently broke the status and decision filters on the Reports page.
 */
@Configuration
public class WebConversionConfig implements WebMvcConfigurer {

    @Override
    public void addFormatters(FormatterRegistry registry) {
        registry.addConverter(String.class, CaseStatus.class, CaseStatus::fromWireValue);
        registry.addConverter(String.class, DecisionType.class, DecisionType::fromWireValue);
        registry.addConverter(String.class, RegistrationStatus.class, RegistrationStatus::fromWireValue);
        registry.addConverter(String.class, AppealStatus.class, AppealStatus::fromWireValue);
        registry.addConverter(String.class, Role.class, Role::fromWireValue);
    }
}
