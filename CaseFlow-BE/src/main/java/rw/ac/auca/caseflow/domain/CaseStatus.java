package rw.ac.auca.caseflow.domain;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum CaseStatus {
    REPORTED("Reported"),
    UNDER_REVIEW("Under Review"),
    DECIDED("Decided"),
    UNDER_APPEAL("Under Appeal"),
    RESOLVED("Resolved");

    private final String wireValue;

    CaseStatus(String wireValue) {
        this.wireValue = wireValue;
    }

    @JsonValue
    public String wireValue() {
        return wireValue;
    }

    @JsonCreator
    public static CaseStatus fromWireValue(String value) {
        for (CaseStatus status : values()) {
            if (status.wireValue.equalsIgnoreCase(value)) {
                return status;
            }
        }
        throw new IllegalArgumentException("Unknown case status: " + value);
    }
}
