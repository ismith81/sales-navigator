#!/usr/bin/env python3
"""
fill_template.py - Fills the case-template.docx with structured case data.
Uses unpack -> edit XML -> repack to preserve exact template formatting.

Usage:
    python fill_template.py --template case-template.docx --output filled.docx --json data.json
"""

import argparse
import json
import os
import re
import subprocess
import tempfile

DOCX_SCRIPTS = "/mnt/skills/public/docx/scripts/office"


def unpack(docx_path, unpack_dir):
    subprocess.run(
        ["python", f"{DOCX_SCRIPTS}/unpack.py", docx_path, unpack_dir],
        check=True, capture_output=True, text=True,
    )


def pack(unpack_dir, output_path, original_path):
    subprocess.run(
        ["python", f"{DOCX_SCRIPTS}/pack.py", unpack_dir, output_path, "--original", original_path],
        check=True, capture_output=True, text=True,
    )


def xml_escape(text):
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def replace_field(xml, placeholder, value):
    """Replace placeholder text in a <w:t> and update styling from italic/grey to normal/black."""
    if not value:
        return xml

    value_escaped = xml_escape(value)
    placeholder_escaped = xml_escape(placeholder)

    # Find and replace the placeholder text
    for search in [placeholder, placeholder_escaped]:
        old_tag = f"<w:t>{search}</w:t>"
        if old_tag in xml:
            new_tag = f'<w:t xml:space="preserve">{value_escaped}</w:t>'
            xml = xml.replace(old_tag, new_tag, 1)

            # Update the run properties: remove italic, change color to dark
            # Find the <w:r> containing our new text and fix its <w:rPr>
            pos = xml.find(new_tag)
            if pos > 0:
                # Look backwards for the <w:rPr> in this run
                run_start = xml.rfind("<w:r>", 0, pos)
                if run_start > 0:
                    rpr_region = xml[run_start:pos]
                    new_rpr = rpr_region
                    new_rpr = re.sub(r"\s*<w:i/>", "", new_rpr)
                    new_rpr = re.sub(r"\s*<w:iCs/>", "", new_rpr)
                    new_rpr = new_rpr.replace(
                        '<w:color w:val="667085"/>',
                        '<w:color w:val="344054"/>',
                    )
                    xml = xml[:run_start] + new_rpr + xml[pos:]
            break

    return xml


def replace_checkbox(xml, label, checked):
    """Replace empty checkbox with checked checkbox."""
    if checked:
        xml = xml.replace(f"\u2610  {label}", f"\u2611  {label}")
    return xml


def fill_toelichting(xml, label, toelichting):
    """Fill in the toelichting cell next to a checked mapping checkbox."""
    if not toelichting:
        return xml

    toelichting_escaped = xml_escape(toelichting)

    # Find checked label position
    checked_label = f"\u2611  {xml_escape(label)}"
    if checked_label not in xml:
        checked_label = f"\u2611  {label}"
    pos = xml.find(checked_label)
    if pos == -1:
        return xml

    # Find the next empty self-closing paragraph <w:p .../> within ~2000 chars
    search_region = xml[pos:pos + 2000]
    match = re.search(
        r'(<w:p\s+w14:paraId="[^"]*"\s+w14:textId="[^"]*"\s+w:rsidR="[^"]*"\s+w:rsidRDefault="[^"]*"/>)',
        search_region,
    )
    if match:
        old_p = match.group(1)
        attrs = re.search(r"<w:p\s+(.*?)/>", old_p).group(1)
        new_p = (
            f'<w:p {attrs}>'
            f'<w:r>'
            f'<w:rPr><w:color w:val="344054"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>'
            f'<w:t xml:space="preserve">{toelichting_escaped}</w:t>'
            f'</w:r></w:p>'
        )
        abs_pos = pos + match.start()
        xml = xml[:abs_pos] + new_p + xml[abs_pos + len(old_p):]

    return xml


def remove_example_section(xml):
    """Remove only the 'Voorbeeld: CITO' example block, keeping the mapping section."""
    marker = "Voorbeeld: CITO"
    pos = xml.find(marker)
    if pos == -1:
        return xml

    # The Voorbeeld section consists of:
    # 1. A spacer paragraph (spacing before=400)
    # 2. A green divider paragraph (pBdr with 00B377)
    # 3. The Heading2 "Voorbeeld: CITO"
    # 4. Description paragraphs and the example table
    #
    # We find the green divider before the heading, then remove from there to <w:sectPr>.

    # Find the green divider paragraph (00B377) before the Voorbeeld heading
    divider_pos = xml.rfind("00B377", 0, pos)
    if divider_pos == -1:
        return xml

    # Walk back to find the <w:p that contains this divider
    p_start = xml.rfind("<w:p ", 0, divider_pos)
    if p_start == -1:
        return xml

    # Also remove the spacer paragraph before the divider (spacing before=400)
    before_region = xml[max(0, p_start - 300):p_start]
    spacer_match = before_region.rfind("<w:p ")
    if spacer_match >= 0:
        candidate = before_region[spacer_match:]
        if "w:before=" in candidate and "<w:p " not in candidate[5:]:
            p_start = max(0, p_start - 300) + spacer_match

    # Keep <w:sectPr> and everything after it
    sect_start = xml.find("<w:sectPr", p_start)
    if sect_start > 0:
        xml = xml[:p_start] + xml[sect_start:]

    return xml


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--template", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--json", required=True)
    args = parser.parse_args()

    with open(args.json, "r", encoding="utf-8") as f:
        data = json.load(f)

    with tempfile.TemporaryDirectory() as tmpdir:
        unpack_dir = os.path.join(tmpdir, "unpacked")
        unpack(args.template, unpack_dir)

        doc_xml = os.path.join(unpack_dir, "word", "document.xml")
        with open(doc_xml, "r", encoding="utf-8") as f:
            xml = f.read()

        # Fill main fields
        fields = {
            "[Vul in: naam van de klant]": data.get("bedrijfsnaam", ""),
            "[Vul in: bijv. Wereldwijde logistieke dienstverlener]": data.get("korte_omschrijving", ""),
            "[Wat was het probleem of de ambitie van de klant? Beschrijf de uitgangssituatie.]": data.get("situatie", ""),
            "[Wat moest er bereikt worden? Wat was de gewenste eindsituatie?]": data.get("doel", ""),
            "[Wat hebben jullie gebouwd/gedaan? Beschrijf de architectuur, technische keuzes en aanpak.]": data.get("oplossing", ""),
            "[Wat is er opgeleverd? Wat is het concrete resultaat?]": data.get("resultaat", ""),
            "[Bijv. Azure, Databricks, Power BI, Delta Lake, API Management]": data.get("keywords", ""),
            "[Wat leverde het de klant concreet op? Denk aan: tijdsbesparing, kostenverlaging, omzetgroei, betere besluitvorming, etc.]": data.get("business_impact", ""),
        }
        for placeholder, value in fields.items():
            xml = replace_field(xml, placeholder, value)

        # Fill mapping sections
        mapping = data.get("mapping", {})
        for section in ["doelen", "behoeften", "diensten"]:
            items = mapping.get(section, {})
            for label, toelichting in items.items():
                is_checked = bool(toelichting)
                xml = replace_checkbox(xml, label, is_checked)
                if is_checked:
                    xml = fill_toelichting(xml, label, toelichting)

        # Remove example section
        xml = remove_example_section(xml)

        with open(doc_xml, "w", encoding="utf-8") as f:
            f.write(xml)

        os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
        pack(unpack_dir, args.output, args.template)

    print(f"Created: {args.output}")


if __name__ == "__main__":
    main()
