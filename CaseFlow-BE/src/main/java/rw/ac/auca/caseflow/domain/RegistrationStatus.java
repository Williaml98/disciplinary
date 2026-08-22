package rw.ac.auca.caseflow.domain;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum RegistrationStatus {
    ACTIVE("Active"),
    RESTRICTED("Restricted"),
    FLAGGED("Flagged");

    private final String wireValue;

    RegistrationStatus(String wireValue) {
        this.wireValue = wireValue;
    }

    @JsonValue
    public String wireValue() {
        return wireValue;
    }

    @JsonCreator
    public static RegistrationStatus fromWireValue(String value) {
        return WireValues.parse(
                RegistrationStatus.class, value, RegistrationStatus::wireValue, "registration status");
    }
}
