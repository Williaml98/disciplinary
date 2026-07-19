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
        for (RegistrationStatus status : values()) {
            if (status.wireValue.equalsIgnoreCase(value)) {
                return status;
            }
        }
        throw new IllegalArgumentException("Unknown registration status: " + value);
    }
}
