package rw.ac.auca.caseflow.domain;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum DecisionType {
    WARNING("Warning"),
    PROBATION("Probation"),
    SEMESTER_SUSPENSION("Semester Suspension"),
    EXPULSION("Expulsion"),
    CLEARED("Cleared");

    private final String wireValue;

    DecisionType(String wireValue) {
        this.wireValue = wireValue;
    }

    @JsonValue
    public String wireValue() {
        return wireValue;
    }

    @JsonCreator
    public static DecisionType fromWireValue(String value) {
        for (DecisionType type : values()) {
            if (type.wireValue.equalsIgnoreCase(value)) {
                return type;
            }
        }
        throw new IllegalArgumentException("Unknown decision type: " + value);
    }
}
