# rust-circuit

This project aims to provide a pluggable markdown compiler that can generate images of circuit diagrams comprised of components from the video game Rust by Facepunch studios

# Grammar

The EBNF grammar for this interpreter is apprximately

```EBNF
document = circuit_preamble {device}
circuit_preamble = CIRCUIT literal {circuit_attribute}
circuit_attribute = circuit_input | circuit_output | circuit_variable

device = literal {device_attribute}
device_attribute = device_connection | device_setting
device_connection = (OUT | literal) TO literal (IN | ANY | literal)
device_setting = SET literal ASSIGN literal

literal = /\w+/i | QUOTE /[^QUOTE]+/i QUOTE

QUOTE = '"'
CIRCUIT = 'circuit'
OUT = 'out'
IN = 'in'
TO = 'to'
ANY = 'any'
SET = 'set'
ASSIGN = '='
```
