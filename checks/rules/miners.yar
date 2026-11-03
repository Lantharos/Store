rule cryptocurrency_miner
{
  meta:
    description = "Contains a cryptocurrency miner or its pool configuration"
  strings:
    $stratum = "stratum+tcp://" ascii wide nocase
    $stratum_ssl = "stratum+ssl://" ascii wide nocase
    $xmrig = "xmrig" ascii wide nocase
    $donate = "--donate-level" ascii
    $randomx = "randomx" ascii nocase
    $cryptonight = "cryptonight" ascii nocase
  condition:
    any of ($stratum, $stratum_ssl) or 2 of ($xmrig, $donate, $randomx, $cryptonight)
}
