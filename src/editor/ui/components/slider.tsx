import React, { useState, useEffect, useRef, useCallback } from 'react';

export interface SliderProps {
    uuid:          string;
    min?:          number;
    max?:          number;
    defaultValue?: number;
    onChange?:     (value: number) => void;
}

const Slider: React.FC<SliderProps> = ({ uuid, min, max, defaultValue, onChange }) => {
    const [value, setValue] = useState<number>(defaultValue);
    const sliderRef         = useRef<HTMLInputElement>(null);

    const handleChange = useCallback((event) => {
        const newValue = parseInt(event.target.value);
        setValue(newValue);
        if (onChange) { onChange(newValue); }
    }, [onChange]);

    useEffect(() => {
        const slider = sliderRef.current;
        if (!slider) return;

        slider.min   = `${min ? min : 0}`;
        slider.max   = `${max ? max : 0}`;
        slider.value = `${defaultValue ? defaultValue : 0}`;

        slider.addEventListener('input', handleChange);

        // for cleanup -> so that the event handlers won't stack up unnecessarily
        return () => { slider.removeEventListener('input', handleChange); };
    }, [min, max, defaultValue, handleChange]);

    return (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
            <input
                id={`slider-${uuid}`}
                type="range"
                step="1"
                style={{ width: "100%" }}
                ref={sliderRef}
            />
        </div>
    );
}

export default Slider;