/**
 * @file Lua grammar for tree-sitter
 * @author Munif Tanjim
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const PREC = {
  OR: 1, // or
  AND: 2, // and
  COMPARE: 3, // < > <= >= ~= ==
  BIT_OR: 4, // |
  BIT_NOT: 5, // ~
  BIT_AND: 6, // &
  BIT_SHIFT: 7, // << >>
  CONCAT: 8, // ..
  PLUS: 9, // + -
  MULTI: 10, // * / // %
  UNARY: 11, // not # - ~
  POWER: 12, // ^
};

const list_seq = (rule, separator, trailing_separator = false) =>
  trailing_separator
    ? seq(rule, repeat(seq(separator, rule)), optional(separator))
    : seq(rule, repeat(seq(separator, rule)));

const optional_block = ($) => alias(optional($._block), $.block);

// namelist ::= Name {',' Name}
const name_list = ($) => list_seq(field('name', $.identifier), ',');

module.exports = grammar({
  name: 'lua',

  extras: ($) => [$.comment, /\s/],

  conflicts: ($) => [
    [$.variable_declaration, $.typed_declaration],
    [$.field, $.variable],
    [$._expression_list, $._variable_assignment_explist],
    [$.par_type_list, $.par_type],
    [$.par_type],
    [$.function_type],
    [$.type],
    [$.type_list],
    [$.return_list],
  ],

  externals: ($) => [
    $._block_comment_start,
    $._block_comment_content,
    $._block_comment_end,

    $._block_string_start,
    $._block_string_content,
    $._block_string_end,
  ],

  supertypes: ($) => [$.statement, $.expression, $.declaration, $.variable],

  word: ($) => $.identifier,

  rules: {
    // chunk ::= block
    chunk: ($) =>
      seq(
        optional($.hash_bang_line),
        repeat($.statement),
        optional($.return_statement)
      ),

    hash_bang_line: (_) => /#.*/,

    // block ::= {stat} [retstat]
    _block: ($) =>
      choice(
        seq(repeat1($.statement), optional($.return_statement)),
        seq(repeat($.statement), $.return_statement)
      ),

    /*
      stat ::=  ';' |
                varlist '=' explist |
                functioncall |
                label |
                break |
                goto Name |
                do block end |
                while exp do block end |
                repeat block until exp |
                if exp then block {elseif exp then block} [else block] end |
                for Name '=' exp ',' exp [',' exp] do block end |
                for namelist in explist do block end |
                function funcname funcbody |
                local function Name funcbody |
                local namelist ['=' explist]
    */
    statement: ($) =>
      choice(
        $.empty_statement,
        $.assignment_statement,
        $.function_call,
        $.label_statement,
        $.break_statement,
        $.goto_statement,
        $.do_statement,
        $.while_statement,
        $.repeat_statement,
        $.if_statement,
        $.for_statement,
        $.declaration,
      ),

    // basetype ::= ‘string’ | ‘boolean’ | ‘nil’ | ‘number’ |
    //   ‘{’ type {',' type} ‘}’ | ‘{’ type ‘:’ type ‘}’ | functiontype
    //   | nominal
    base_type: ($) => choice(
        'string', 'boolean', 'nil', 'number', field('tuple_type', seq('{', $.type, repeat(seq(',', $.type)), '}')),
        field('map_type', seq('{', $.type, ':', $.type, '}')),
        $.function_type,
        $.nominal
    ),

    // nominal ::= Name {{‘.’ Name }} [typeargs]
    nominal: ($) => seq($.identifier, repeat(seq('.', $.identifier)), optional($.type_args)),

    // type ::= ‘(’ type ‘)’ | basetype {‘|’ basetype}
    type: ($) => choice(
      seq('(', $.type, ')'),
      seq($.base_type, repeat(seq('|', $.base_type))),
    ),

    // typelist ::= type {',' type}
    type_list: ($) => seq($.type, repeat1(seq(',', $.type))),

    // retlist ::= ‘(’ [typelist] [‘...’] ‘)’ | typelist [‘...’]
    //
    return_list: ($) =>
      choice(
        seq('(', optional($.type_list), optional('...'), ')'),
        seq($.type_list, optional('...'))),

    // typeargs ::= ‘<’ Name {‘,’ Name } ‘>’
    //
    type_args: ($) => seq('<', $.identifier, repeat(seq(',', $.identifier)), '>'),

    // newtype ::= ‘record’ recordbody | ‘enum’ enumbody | type
    //     | ‘require’ ‘(’ LiteralString ‘)’ {‘.’ Name }
    new_type: ($) =>
      choice(
        seq('record', $._record_body),
        seq('enum', $._enum_body),
        $.type,
        seq('require', '(', $.string, ')', repeat(seq('.', $.identifier))),
      ),

    // stmt ::= ... | ‘local’ attnamelist [‘:’ typelist] [‘=’ explist] | ...
    typed_declaration: ($) =>
      seq('local', $._att_name_list, optional(seq(':', $.type_list)), optional(seq('=', $._expression_list))),

    // interfacelist ::= nominal {‘,’ nominal} |
    //     ‘{’ type ‘}’ {‘,’ nominal}
    interface_list: ($) =>
      choice(
        seq($.nominal, repeat(seq(',', $.nominal))),
          seq('{', $.type, '}', repeat(seq(',', $.nominal)))),
    
    // stmt ::= ... | ‘local’ ‘record’ Name recordbody | ...
    record_declaration: ($) => seq('local', 'record', field('name', $.identifier), $._record_body),

    // stmt ::= ... | ‘local’ ‘interface’ Name recordbody |
    interface_declaration: ($) => seq('local', 'interface', field('name', $.identifier), $._record_body),

    // stmt ::= ... | ‘local’ ‘enum’ Name enumbody |
    enum_declaration: ($) => seq('local', 'enum', field('name', $.identifier), $._enum_body),

    // stmt ::= ... | ‘local’ ‘type’ Name ‘=’ newtype |
    type_declaration: ($) => seq('local', 'type', field('name', $.identifier), $.new_type),

    // stmt ::= ... | ‘global’ attnamelist ‘=’ explist |
    global_declaration: ($) => seq('global', $._att_name_list, '=', $._expression_list),

    // stmt ::= ... | ‘global’ attnamelist ‘:’ typelist [‘=’ explist] |
    global_typed_declaration: ($) =>
      seq(
        'global',
        $._att_name_list,
        ':',
        $.type_list,
        optional(seq('=', $._expression_list))
      ),

    // stmt ::= ... | ‘global’ ‘function’ Name funcbody |
    global_function_declaration: ($) => seq('global', 'function', field('name', $.identifier), $._function_body),

    // stmt ::= ... | ‘global’ ‘record’ Name recordbody |
    global_record_declaration: ($) => seq('global', 'record', field('name', $.identifier), $._record_body),

    // stmt ::= ... | ‘global’ ‘interface’ Name recordbody |
    global_interface_declaration: ($) => seq('global', 'interface', field('name', $.identifier), $._record_body),

    // stmt ::= ... | ‘global’ ‘enum’ Name enumbody |
    global_enum_declaration: ($) => seq('global', 'enum', field('name', $.identifier), $._enum_body),

    // stmt ::= ... | ‘global’ ‘type’ Name [‘=’ newtype]
    global_type_declaration: ($) => seq('global', 'type', field('name', $.identifier), optional(seq('=', $.new_type))),

    // recordbody ::= [typeargs] [‘is’ interfacelist]
    //     [‘where’ exp] {recordentry} ‘end’
    _record_body: ($) =>
      seq(
        optional($.type_args),
        optional(seq('is', $.interface_list)),
        optional(seq('where', $.expression)),
        repeat($.record_entry),
        'end'),

    // recordentry ::= ‘userdata’ |
    //     ‘type’ Name ‘=’ newtype | [‘metamethod’] recordkey ‘:’ type |
    //     ‘record’ Name recordbody | ‘enum’ Name enumbody
    record_entry: ($) =>
      choice(
        'userdata',
        seq('type', $.identifier, '=', $.new_type),
        seq(optional('metamethod'), $.record_key, ':', $.type),
        seq('record', $.identifier, $._record_body),
        seq('enum', $.identifier, $._enum_body),
      ),

    // recordkey ::= Name | ‘[’ LiteralString ‘]’
    record_key: ($) => choice($.identifier, seq('[', $.string, ']')),

    // enumbody ::= {LiteralString} ‘end’
    _enum_body: ($) => seq(repeat($.string), 'end'),

    // functiontype ::= ‘function’ [typeargs] ‘(’ partypelist ‘)’ [‘:’ retlist]
    function_type: ($) => seq('function', optional($.type_args), '(', $.par_type_list, ')', optional(seq(':', $.return_list))), 

    // parlist ::= parnamelist [‘,’ ‘...’ [‘:’ type]] | ‘...’ [‘:’ type]
    par_list: ($) => seq($.par_name_list, optional(seq(',', '...', optional(seq(':', field('type', $.type)))))),

    // partypelist ::= partype {‘,’ partype}
    par_type_list: ($) => seq($.par_type, repeat(seq(',', $.par_type))),

    // partype ::= Name [‘?’] ‘:’ type | [‘?’] type
    par_type: ($) =>
      choice(
        seq($.identifier, optional('?'), ':', field('type', $.type)),
        seq(optional('?'), $.par_type)
      ),

    // parnamelist ::= parname {‘,’ parname}
    par_name_list: ($) => seq($.par_name, repeat(seq(',', $.par_name))),

    // parname ::= Name [‘?’] [‘:’ type]
    par_name: ($) => seq($.identifier, optional('?'), optional(seq(':', field('type', $.type)))),

    // retstat ::= return [explist] [';']
    return_statement: ($) =>
      seq(
        'return',
        optional(alias($._expression_list, $.expression_list)),
        optional(';')
      ),

    // ';'
    empty_statement: (_) => ';',

    // varlist '=' explist
    assignment_statement: ($) =>
      seq(
        alias($._variable_assignment_varlist, $.variable_list),
        '=',
        alias($._variable_assignment_explist, $.expression_list)
      ),
    // varlist ::= var {',' var}
    _variable_assignment_varlist: ($) =>
      list_seq(field('name', $.variable), ','),
    // explist ::= exp {',' exp}
    _variable_assignment_explist: ($) =>
      list_seq(field('value', $.expression), ','),

    // label ::= '::' Name '::'
    label_statement: ($) => seq('::', $.identifier, '::'),

    // break
    break_statement: (_) => 'break',

    // goto Name
    goto_statement: ($) => seq('goto', $.identifier),

    // do block end
    do_statement: ($) => seq('do', field('body', optional_block($)), 'end'),

    // while exp do block end
    while_statement: ($) =>
      seq(
        'while',
        field('condition', $.expression),
        'do',
        field('body', optional_block($)),
        'end'
      ),

    // repeat block until exp
    repeat_statement: ($) =>
      seq(
        'repeat',
        field('body', optional_block($)),
        'until',
        field('condition', $.expression)
      ),

    // if exp then block {elseif exp then block} [else block] end
    if_statement: ($) =>
      seq(
        'if',
        field('condition', $.expression),
        'then',
        field('consequence', optional_block($)),
        repeat(field('alternative', $.elseif_statement)),
        optional(field('alternative', $.else_statement)),
        'end'
      ),
    // elseif exp then block
    elseif_statement: ($) =>
      seq(
        'elseif',
        field('condition', $.expression),
        'then',
        field('consequence', optional_block($))
      ),
    // else block
    else_statement: ($) => seq('else', field('body', optional_block($))),

    // for Name '=' exp ',' exp [',' exp] do block end
    // for namelist in explist do block end
    for_statement: ($) =>
      seq(
        'for',
        field('clause', choice($.for_generic_clause, $.for_numeric_clause)),
        'do',
        field('body', optional_block($)),
        'end'
      ),
    // namelist in explist
    for_generic_clause: ($) =>
      seq(
        alias($._name_list, $.variable_list),
        'in',
        alias($._expression_list, $.expression_list)
      ),
    // Name '=' exp ',' exp [',' exp]
    for_numeric_clause: ($) =>
      seq(
        field('name', $.identifier),
        '=',
        field('start', $.expression),
        ',',
        field('end', $.expression),
        optional(seq(',', field('step', $.expression)))
      ),

    // function funcname funcbody
    // local function Name funcbody
    // local namelist ['=' explist]
    declaration: ($) =>
      choice(
        $.function_declaration,
        field(
          'local_declaration',
          alias($._local_function_declaration, $.function_declaration)
        ),
        field('local_declaration', $.variable_declaration),
        field('local_declaration', $.typed_declaration),
        field('record_declaration', $.record_declaration),
        field('interface_declaration', $.interface_declaration),
        field('enum_declaration', $.enum_declaration),
        field('type_declaration', $.type_declaration),
        field('global_declaration', $.global_declaration),
        field('global_typed_declaration', $.global_typed_declaration),
        field('global_record_declaration', $.global_record_declaration),
        field('global_interface_declaration', $.global_interface_declaration),
        field('global_enum_declaration', $.global_enum_declaration),
        field('global_function_declaration', $.global_function_declaration),
        field('global_type_declaration', $.global_type_declaration),
      ),
    // function funcname funcbody
    function_declaration: ($) =>
      seq('function', field('name', $._function_name), $._function_body),
    // local function Name funcbody
    _local_function_declaration: ($) =>
      seq('local', 'function', field('name', $.identifier), $._function_body),
    // funcname ::= Name {'.' Name} [':' Name]
    _function_name: ($) =>
      choice(
        $._function_name_prefix_expression,
        alias(
          $._function_name_method_index_expression,
          $.method_index_expression
        )
      ),
    _function_name_prefix_expression: ($) =>
      choice(
        $.identifier,
        alias($._function_name_dot_index_expression, $.dot_index_expression)
      ),
    _function_name_dot_index_expression: ($) =>
      seq(
        field('table', $._function_name_prefix_expression),
        '.',
        field('field', $.identifier)
      ),
    _function_name_method_index_expression: ($) =>
      seq(
        field('table', $._function_name_prefix_expression),
        ':',
        field('method', $.identifier)
      ),

    // local namelist ['=' explist]
    variable_declaration: ($) =>
      seq(
        'local',
        choice(
          alias($._att_name_list, $.variable_list),
          alias($._local_variable_assignment, $.assignment_statement)
        )
      ),
    _local_variable_assignment: ($) =>
      seq(
        alias($._att_name_list, $.variable_list),
        '=',
        alias($._variable_assignment_explist, $.expression_list)
      ),
    // namelist ::= Name {',' Name}
    _name_list: ($) => name_list($),

    // attnamelist ::=  Name attrib {‘,’ Name attrib}
    _att_name_list: ($) =>
      list_seq(
        seq(
          field('name', $.identifier),
          optional(field('attribute', alias($._attrib, $.attribute)))
        ),
        ','
      ),
    // attrib ::= [‘<’ Name ‘>’]
    _attrib: ($) => seq('<', $.identifier, '>'),

    // explist ::= exp {',' exp}
    _expression_list: ($) => list_seq($.expression, ','),

    /*
      exp ::=  nil | false | true | Numeral | LiteralString | '...' | functiondef |
               prefixexp | tableconstructor | exp binop exp | unop exp
     */
    expression: ($) =>
      choice(
        $.nil,
        $.false,
        $.true,
        $.number,
        $.string,
        $.vararg_expression,
        $.function_definition,
        $.variable,
        $.function_call,
        $.parenthesized_expression,
        $.table_constructor,
        $.binary_expression,
        $.unary_expression
      ),

    // nil
    nil: (_) => 'nil',

    // false
    false: (_) => 'false',

    // true
    true: (_) => 'true',

    // Numeral
    number: (_) => {
      function number_literal(digits, exponent_marker, exponent_digits) {
        return choice(
          seq(digits, /U?LL/i),
          seq(
            choice(
              seq(optional(digits), optional('.'), digits),
              seq(digits, optional('.'), optional(digits))
            ),
            optional(
              seq(
                choice(
                  exponent_marker.toLowerCase(),
                  exponent_marker.toUpperCase()
                ),
                seq(optional(choice('-', '+')), exponent_digits)
              )
            ),
            optional(choice('i', 'I'))
          )
        );
      }

      const decimal_digits = /[0-9]+/;
      const decimal_literal = number_literal(
        decimal_digits,
        'e',
        decimal_digits
      );

      const hex_digits = /[a-fA-F0-9]+/;
      const hex_literal = seq(
        choice('0x', '0X'),
        number_literal(hex_digits, 'p', decimal_digits)
      );

      const bin_digits = /[01]+/;
      const bin_literal = seq(
        choice('0b', '0B'),
        choice(
          seq(bin_digits, /U?LL/i),
          seq(bin_digits, optional(choice('i', 'I')))
        )
      );

      return token(choice(decimal_literal, hex_literal, bin_literal));
    },

    // LiteralString
    string: ($) => choice($._quote_string, $._block_string),

    _quote_string: ($) =>
      choice(
        seq(
          field('start', alias('"', '"')),
          field(
            'content',
            optional(alias($._doublequote_string_content, $.string_content))
          ),
          field('end', alias('"', '"'))
        ),
        seq(
          field('start', alias("'", "'")),
          field(
            'content',
            optional(alias($._singlequote_string_content, $.string_content))
          ),
          field('end', alias("'", "'"))
        )
      ),

    _doublequote_string_content: ($) =>
      repeat1(choice(token.immediate(prec(1, /[^"\\]+/)), $.escape_sequence)),

    _singlequote_string_content: ($) =>
      repeat1(choice(token.immediate(prec(1, /[^'\\]+/)), $.escape_sequence)),

    _block_string: ($) =>
      seq(
        field('start', alias($._block_string_start, '[[')),
        field('content', alias($._block_string_content, $.string_content)),
        field('end', alias($._block_string_end, ']]'))
      ),

    escape_sequence: () =>
      token.immediate(
        seq(
          '\\',
          choice(
            /[\nabfnrtv\\'"]/,
            /z\s*/,
            /[0-9]{1,3}/,
            /x[0-9a-fA-F]{2}/,
            /u\{[0-9a-fA-F]+\}/
          )
        )
      ),

    // '...'
    vararg_expression: (_) => '...',

    // functiondef ::= function funcbody
    function_definition: ($) => seq('function', $._function_body),
    // funcbody ::= '(' [parlist] ')' block end
    _function_body: ($) =>
      seq(
        field('parameters', $.parameters),
        field('body', optional_block($)),
        'end'
      ),
    // '(' [parlist] ')'
    parameters: ($) => seq('(', optional($._parameter_list), ')'),
    // parlist ::= namelist [',' '...'] | '...'
    _parameter_list: ($) =>
      choice(
        seq(name_list($), optional(seq(',', $.vararg_expression))),
        $.vararg_expression
      ),

    // prefixexp ::= var | functioncall | '(' exp ')'
    _prefix_expression: ($) =>
      prec(1, choice($.variable, $.function_call, $.parenthesized_expression)),

    // var ::=  Name | prefixexp [ exp ] | prefixexp . Name
    variable: ($) =>
      choice($.identifier, $.bracket_index_expression, $.dot_index_expression),
    // prefixexp [ exp ]
    bracket_index_expression: ($) =>
      seq(
        field('table', $._prefix_expression),
        '[',
        field('field', $.expression),
        ']'
      ),
    // prefixexp . Name
    dot_index_expression: ($) =>
      seq(
        field('table', $._prefix_expression),
        '.',
        field('field', $.identifier)
      ),

    // functioncall ::=  prefixexp args | prefixexp ':' Name args
    function_call: ($) =>
      seq(
        field('name', choice($._prefix_expression, $.method_index_expression)),
        field('arguments', $.arguments)
      ),
    // prefixexp ':' Name
    method_index_expression: ($) =>
      seq(
        field('table', $._prefix_expression),
        ':',
        field('method', $.identifier)
      ),
    // args ::=  '(' [explist] ')' | tableconstructor | LiteralString
    arguments: ($) =>
      choice(
        seq('(', optional(list_seq($.expression, ',')), ')'),
        $.table_constructor,
        $.string
      ),

    // '(' exp ')'
    parenthesized_expression: ($) => seq('(', $.expression, ')'),

    // tableconstructor ::= '{' [fieldlist] '}'
    table_constructor: ($) => seq('{', optional($._field_list), '}'),
    // fieldlist ::= field {fieldsep field} [fieldsep]
    _field_list: ($) => list_seq($.field, $._field_sep, true),
    // fieldsep ::= ',' | ';'
    _field_sep: (_) => choice(',', ';'),
    // field ::= '[' exp ']' '=' exp | Name '=' exp | exp
    field: ($) =>
      choice(
        seq(
          '[',
          field('name', $.expression),
          ']',
          '=',
          field('value', $.expression)
        ),
        seq(field('name', $.identifier), '=', field('value', $.expression)),
        field('value', $.expression),
        seq(
          field('name', $.identifier),
          optional(seq(':', field('type', $.type))),
          '=',
          field('value', $.expression)
        ),
      ),

    // exp binop exp
    binary_expression: ($) =>
      choice(
        ...[
          ['or', PREC.OR],
          ['and', PREC.AND],
          ['<', PREC.COMPARE],
          ['<=', PREC.COMPARE],
          ['==', PREC.COMPARE],
          ['~=', PREC.COMPARE],
          ['>=', PREC.COMPARE],
          ['>', PREC.COMPARE],
          ['|', PREC.BIT_OR],
          ['~', PREC.BIT_NOT],
          ['&', PREC.BIT_AND],
          ['<<', PREC.BIT_SHIFT],
          ['>>', PREC.BIT_SHIFT],
          ['+', PREC.PLUS],
          ['-', PREC.PLUS],
          ['*', PREC.MULTI],
          ['/', PREC.MULTI],
          ['//', PREC.MULTI],
          ['%', PREC.MULTI],
        ].map(([operator, precedence]) =>
          prec.left(
            precedence,
            seq(
              field('left', $.expression),
              operator,
              field('right', $.expression)
            )
          )
        ),
        ...[
          ['..', PREC.CONCAT],
          ['^', PREC.POWER],
        ].map(([operator, precedence]) =>
          prec.right(
            precedence,
            seq(
              field('left', $.expression),
              operator,
              field('right', $.expression)
            )
          )
        )
      ),

    // unop exp
    unary_expression: ($) =>
      prec.left(
        PREC.UNARY,
        seq(choice('not', '#', '-', '~'), field('operand', $.expression))
      ),

    // Name
    identifier: (_) => {
      const identifier_start =
        /[^\p{Control}\s+\-*/%^#&~|<>=(){}\[\];:,.\\'"\d]/;
      const identifier_continue =
        /[^\p{Control}\s+\-*/%^#&~|<>=(){}\[\];:,.\\'"]*/;
      return token(seq(identifier_start, identifier_continue));
    },

    // comment
    comment: ($) =>
      choice(
        seq(
          field('start', '--'),
          field('content', alias(/[^\r\n]*/, $.comment_content))
        ),
        seq(
          field('start', alias($._block_comment_start, '[[')),
          field('content', alias($._block_comment_content, $.comment_content)),
          field('end', alias($._block_comment_end, ']]'))
        )
      ),
  },
});
