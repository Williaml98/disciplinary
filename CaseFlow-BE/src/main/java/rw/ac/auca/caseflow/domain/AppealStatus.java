package rw.ac.auca.caseflow.domain;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum AppealStatus {
    PENDING("Pending"),
    UPHELD("Upheld"),
    OVERTURNED("Overturned");

    private final String wireValue;

    AppealStatus(String wireValue) {
        this.wireValue = wireValue;
    }

    @JsonValue
    public String wireValue() {
        return wireValue;
    }

    @JsonCreator
    public static AppealStatus fromWireValue(String value) {
        return WireValues.parse(AppealStatus.class, value, AppealStatus::wireValue, "appeal status");
    }
}
