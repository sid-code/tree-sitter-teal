{
  description = "Tree-sitter grammer for Teal";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";
  };

  outputs =
    { self, nixpkgs }:
    let
      supportedSystems = [ "x86_64-linux" ];
      forEachSystem =
        f:
        nixpkgs.lib.genAttrs supportedSystems (
          system:
          f {
            inherit system;
            pkgs = import nixpkgs { inherit system; };
          }
        );
    in
    {
      packages = forEachSystem (
        { pkgs, ... }:
        {
          default = pkgs.tree-sitter.buildGrammar {
            pname = "tree-sitter-teal";
            language = "teal";
            version = "0.0.0";
            src = ./.;
          };
        }
      );
    };
}
