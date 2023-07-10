import React, { CSSProperties, useCallback } from "react";

export interface TextButtonProps {
    text?:    string
    onClick?: (button: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
    style?:   CSSProperties;
}

export const TextButton: React.FC<TextButtonProps> = ({ text, onClick, style }) => {

    const defaultStyle: CSSProperties = {
        display: "inline-block",
        border: "none",
        borderRadius: "8px",
        textAlign: "center",
        textDecoration: "none",
        fontSize: '14px',
        cursor: "pointer",
        ...style // this will override default styles with the ones provided
    };

    const handleClick = useCallback(
        (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
            if (onClick) { onClick(event); }
        },
        [onClick]
    );

    return (
        <button content={text} onClick={handleClick} style={defaultStyle}>
            
        </button>
    );
};

export default TextButton;