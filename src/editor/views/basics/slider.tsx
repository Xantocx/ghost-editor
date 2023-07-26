import React, { useEffect, useRef, useCallback } from 'react';

export interface SliderProps {
    uuid:          string;
    min?:          number;
    max?:          number;
    defaultValue?: number;
    onChange?:     (value: number) => void;
}

const Slider: React.FC<SliderProps> = ({ uuid, min, max, defaultValue, onChange }) => {
    const sliderRef    = useRef<HTMLInputElement>(null);

    const handleChange = useCallback((event: any) => {
        const newValue = parseInt(event.target.value);
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
        <input
            id={`slider-${uuid}`}
            type="range"
            step="1"
            ref={sliderRef}
            style={{ display: "flex", justifyContent: "center", alignItems: "center", width: "100%" }}
        />
    );
}

export default Slider;