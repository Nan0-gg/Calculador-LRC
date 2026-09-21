// ============================================================
// CALCULADORA LRC TEF
// ============================================================
//
// Estructura esperada:
//
// [06 opcional] [02 STX] [LENGTH] [DATA] [03 ETX] [LRC]
//
// Reglas:
//
// 06 = ACK opcional
// 02 = STX
// 03 = ETX
//
// El LRC se calcula mediante XOR byte a byte desde el primer
// byte posterior al STX hasta el ETX incluido.
//
// El STX y el ACK no participan en el cálculo.
//
// ============================================================


// ============================================================
// ELEMENTOS DEL DOM
// ============================================================

const inputFrame = document.getElementById("inputFrame");

const resultFrame = document.getElementById("resultFrame");

const calculateButton =
    document.getElementById("calculateButton");

const clearButton =
    document.getElementById("clearButton");

const copyButton =
    document.getElementById("copyButton");

const resultPlaceholder =
    document.getElementById("resultPlaceholder");

const lrcResult =
    document.getElementById("lrcResult");

const lrcValue =
    document.getElementById("lrcValue");

const message =
    document.getElementById("message");


// ============================================================
// CONSTANTES DEL PROTOCOLO
// ============================================================

const ACK = 0x06;

const STX = 0x02;

const ETX = 0x03;


// ============================================================
// EVENTOS
// ============================================================

inputFrame.addEventListener("input", function () {

    updateInputState();

    clearMessage();

});


calculateButton.addEventListener("click", function () {

    calculateFrameLRC();

});


clearButton.addEventListener("click", function () {

    clearInput();

});


copyButton.addEventListener("click", async function () {

    await copyResult();

});


// ============================================================
// ACTUALIZAR ESTADO DEL CAMPO DE ENTRADA
// ============================================================

function updateInputState() {

    const hasText =
        inputFrame.value.trim().length > 0;

    clearButton.style.display =
        hasText ? "flex" : "none";
}


// ============================================================
// CONVERTIR TEXTO HEXADECIMAL A BYTES
// ============================================================

function hexToBytes(hexString) {

    const normalized =
        hexString
            .trim()
            .replace(/\s+/g, " ");

    if (normalized.length === 0) {

        throw new Error(
            "Debes ingresar una trama hexadecimal."
        );
    }


    // Permitimos dos formatos:
    //
    // 06 02 01 55 36 30
    //
    // o
    //
    // 060201553630

    let tokens;


    if (normalized.includes(" ")) {

        tokens =
            normalized.split(" ");

    } else {

        if (normalized.length % 2 !== 0) {

            throw new Error(
                "La trama hexadecimal debe contener una cantidad par de caracteres."
            );
        }

        tokens = [];

        for (
            let i = 0;
            i < normalized.length;
            i += 2
        ) {

            tokens.push(
                normalized.substring(i, i + 2)
            );
        }
    }


    const bytes = [];


    for (const token of tokens) {

        if (!/^[0-9A-Fa-f]{2}$/.test(token)) {

            throw new Error(
                `Valor hexadecimal inválido: "${token}"`
            );
        }


        bytes.push(
            parseInt(token, 16)
        );
    }


    return bytes;
}


// ============================================================
// CONVERTIR BYTES A TEXTO HEXADECIMAL
// ============================================================

function bytesToHex(bytes) {

    return bytes
        .map(byte =>
            byte
                .toString(16)
                .toUpperCase()
                .padStart(2, "0")
        )
        .join(" ");
}


// ============================================================
// ENCONTRAR STX
// ============================================================

function findSTX(bytes) {

    const stxIndex =
        bytes.indexOf(STX);


    if (stxIndex === -1) {

        throw new Error(
            "No se encontró el byte STX (02) en la trama."
        );
    }


    // Si existen bytes antes del STX, actualmente
    // solo permitimos que sean un ACK (06).

    if (stxIndex > 0) {

        const bytesBeforeSTX =
            bytes.slice(0, stxIndex);


        const onlyACK =
            bytesBeforeSTX.every(
                byte => byte === ACK
            );


        if (!onlyACK) {

            throw new Error(
                "Se encontraron bytes antes del STX (02) que no corresponden a un ACK (06)."
            );
        }
    }


    return stxIndex;
}


// ============================================================
// ENCONTRAR ETX
// ============================================================

function findETX(bytes, stxIndex) {

    const etxIndex =
        bytes.indexOf(
            ETX,
            stxIndex + 1
        );


    if (etxIndex === -1) {

        throw new Error(
            "No se encontró el byte ETX (03) después del STX."
        );
    }


    return etxIndex;
}


// ============================================================
// CALCULAR LRC
// ============================================================
//
// XOR byte a byte.
//
// Ejemplo:
//
// 00 XOR 62 XOR 36 XOR ... XOR 03
//
// STX (02) NO participa.
// ACK (06) NO participa.
// ETX (03) SÍ participa.
// ============================================================

function calculateLRC(bytes, stxIndex, etxIndex) {

    let lrc = 0x00;


    for (
        let i = stxIndex + 1;
        i <= etxIndex;
        i++
    ) {

        lrc =
            lrc ^ bytes[i];
    }


    return lrc;
}


// ============================================================
// CONSTRUIR TRAMA CON LRC
// ============================================================

function buildFrameWithLRC(
    bytes,
    etxIndex,
    lrc
) {

    // Tomamos todo hasta ETX.
    //
    // Si el usuario pegó una trama que ya tenía LRC,
    // cualquier byte posterior al ETX será reemplazado
    // por el nuevo LRC.

    const frameWithoutLRC =
        bytes.slice(0, etxIndex + 1);


    frameWithoutLRC.push(lrc);


    return frameWithoutLRC;
}


// ============================================================
// CALCULAR LA TRAMA
// ============================================================

function calculateFrameLRC() {

    clearMessage();


    try {

        const input =
            inputFrame.value;


        // ----------------------------------------------------
        // 1. Convertir HEX a bytes
        // ----------------------------------------------------

        let bytes =
            hexToBytes(input);


        // ----------------------------------------------------
        // 2. Encontrar STX
        // ----------------------------------------------------

        const stxIndex =
            findSTX(bytes);


        // ----------------------------------------------------
        // 3. Encontrar ETX
        // ----------------------------------------------------

        const etxIndex =
            findETX(
                bytes,
                stxIndex
            );


        // ----------------------------------------------------
        // 4. Validar que existan al menos los dos bytes
        //    posteriores al STX.
        //
        //    En nuestra estructura:
        //
        //    STX + LENGTH + DATA + ETX
        //
        //    LENGTH ocupa 2 bytes.
        // ----------------------------------------------------

        if (
            etxIndex -
            stxIndex <
            3
        ) {

            throw new Error(
                "La trama no contiene los bytes mínimos esperados después del STX."
            );
        }


        // ----------------------------------------------------
        // 5. Calcular LRC
        // ----------------------------------------------------

        const lrc =
            calculateLRC(
                bytes,
                stxIndex,
                etxIndex
            );


        // ----------------------------------------------------
        // 6. Construir trama final
        // ----------------------------------------------------

        const finalFrame =
            buildFrameWithLRC(
                bytes,
                etxIndex,
                lrc
            );


        // ----------------------------------------------------
        // 7. Mostrar resultado
        // ----------------------------------------------------

        const finalFrameHex =
            bytesToHex(finalFrame);


        resultFrame.value =
            finalFrameHex;


        lrcValue.textContent =
            lrc
                .toString(16)
                .toUpperCase()
                .padStart(2, "0");


        resultPlaceholder.style.display =
            "none";


        lrcResult.style.display =
            "block";


        copyButton.style.display =
            "flex";


        showMessage(
            "LRC calculado correctamente.",
            "success"
        );

    } catch (error) {

        resultFrame.value = "";

        resultPlaceholder.style.display =
            "block";

        lrcResult.style.display =
            "none";

        copyButton.style.display =
            "none";


        showMessage(
            error.message,
            "error"
        );
    }
}


// ============================================================
// LIMPIAR TODO
// ============================================================

function clearInput() {

    inputFrame.value = "";

    resultFrame.value = "";

    lrcValue.textContent = "--";


    clearButton.style.display =
        "none";

    copyButton.style.display =
        "none";

    resultPlaceholder.style.display =
        "block";

    lrcResult.style.display =
        "none";


    clearMessage();

    inputFrame.focus();
}


// ============================================================
// COPIAR RESULTADO
// ============================================================

async function copyResult() {

    const result =
        resultFrame.value.trim();


    if (!result) {

        return;
    }


    try {

        await navigator.clipboard.writeText(
            result
        );


        showMessage(
            "Trama copiada al portapapeles.",
            "success"
        );

    } catch (error) {

        // Método alternativo para navegadores
        // que no permitan navigator.clipboard.

        resultFrame.select();

        document.execCommand("copy");

        showMessage(
            "Trama copiada al portapapeles.",
            "success"
        );
    }
}


// ============================================================
// MOSTRAR MENSAJE
// ============================================================

function showMessage(
    text,
    type
) {

    message.textContent =
        text;

    message.className =
        `message ${type}`;

    message.style.display =
        "block";
}


// ============================================================
// LIMPIAR MENSAJE
// ============================================================

function clearMessage() {

    message.textContent = "";

    message.style.display =
        "none";

    message.className =
        "message";
}


// ============================================================
// ESTADO INICIAL
// ============================================================

updateInputState();