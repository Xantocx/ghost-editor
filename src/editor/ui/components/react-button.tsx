import React, { CSSProperties, useCallback } from "react";

export interface TextButtonProps {
    style:    CSSProperties;
    text?:    string
    onClick?: (button: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
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
        <button onClick={handleClick} style={defaultStyle}>{text}</button>
    );
};

export default TextButton;