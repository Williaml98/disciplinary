package rw.ac.auca.caseflow.domain;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum Role {
    LECTURER("lecturer"),
    COMMITTEE("committee"),
    STUDENT("student"),
    ADMIN("admin");

    private final String wireValue;

    Role(String wireValue) {
        this.wireValue = wireValue;
    }

    @JsonValue
    public String wireValue() {
        return wireValue;
    }

    @JsonCreator
    public static Role fromWireValue(String value) {
        for (Role role : values()) {
            if (role.wireValue.equalsIgnoreCase(value)) {
                return role;
            }
        }
        throw new IllegalArgumentException("Unknown role: " + value);
    }
}
